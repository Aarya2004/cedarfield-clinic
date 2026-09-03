'use client';

/**
 * "Talk to Cedarfield" — the page's own voice client over its own WebMCP tools (2026-09-02).
 *
 * The third client of one tool surface. Codex consumes the page's tools from its pane; Chrome 152
 * exposes them to any agent; and this module lets the page itself host a voice agent (OpenAI
 * Realtime over WebRTC) that consumes the SAME tool definitions through the SAME execute path —
 * so every call it makes lands in the strip, the pulse and the record like any other client's.
 *
 * What it cannot do is exactly what Codex cannot do: press. The agent holds, searches, queues and
 * arms; booking still takes the person's key, palm, or the one grant they pressed for. The agent's
 * voice comes out of the speakers and the page never listens to its own speakers for a confirm.
 *
 * Bounded: a server-minted secret that expires in minutes, a daily ticket count in the database,
 * a five-minute session cap here, and instructions fixed on the server. Without a key on the
 * deployment the button says so and the page is unchanged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** What ClinicTools hands this module: the live tool list and the one execute path. */
export interface VoiceExecutor {
  /** The tools that exist right now (born tools included, dead ones excluded). */
  tools: VoiceToolDef[];
  /** Runs a tool through the same path Codex's calls take; returns the JSON text the tool answered. */
  execute: (name: string, input: unknown, signal?: AbortSignal) => Promise<string>;
}

type VoiceState = 'idle' | 'connecting' | 'live' | 'ended' | 'unavailable';

const SESSION_CAP_MS = 5 * 60_000;

interface RealtimeEvent {
  type: string;
  response?: { output?: Array<{ type: string; name?: string; call_id?: string; arguments?: string }> };
  transcript?: string;
  error?: { message?: string };
}

export interface VoiceAgentProps {
  executor: VoiceExecutor | null;
  /** The page's recognizer or sign camera is capturing: this agent must not start (its speech would be heard as the person's). */
  disabled?: boolean;
  /** Exactly what is blocking, in the person's words (Codex: "say exactly what is blocking it"). */
  disabledReason?: string;
  /** Reports live/not-live so the page can pause the recognizer while the agent talks. */
  onLiveChange?: (live: boolean) => void;
}

export function VoiceAgent({ executor, disabled = false, disabledReason, onLiveChange }: VoiceAgentProps) {
  const [state, setState] = useState<VoiceState>('idle');
  // Readiness before the button (Codex: "do not let a reviewer discover it only after pressing"):
  // the route's GET says whether this deployment can mint a session at all. It spends nothing.
  const [ready, setReady] = useState<{ ok: boolean; reason: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch('/api/voice/session', { method: 'GET' });
        const body = (await r.json()) as { ready?: boolean; detail?: string };
        if (!cancelled) setReady({ ok: body.ready === true, reason: body.detail ?? '' });
      } catch {
        if (!cancelled) setReady({ ok: false, reason: 'Voice could not be checked right now.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const onLiveRef = useRef(onLiveChange);
  onLiveRef.current = onLiveChange;
  useEffect(() => {
    onLiveRef.current?.(state === 'live' || state === 'connecting');
  }, [state]);
  /** Aborts every in-flight tool call (a 60 s wait, say) the moment the session ends. */
  const callsRef = useRef<AbortController | null>(null);
  const [reason, setReason] = useState<string>('');
  const [said, setSaid] = useState<string>('');
  const [calls, setCalls] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const capRef = useRef<number | null>(null);
  const executorRef = useRef(executor);
  useEffect(() => {
    executorRef.current = executor;
  }, [executor]);

  const stop = useCallback((why: VoiceState = 'ended', detail = '') => {
    if (capRef.current !== null) clearTimeout(capRef.current);
    capRef.current = null;
    callsRef.current?.abort();
    callsRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    setState(why);
    setReason(detail);
  }, []);

  useEffect(() => () => stop('idle'), [stop]);

  /** The tool list, as the Realtime session sees it. Re-sent whenever the page's list changes. */
  const sendTools = useCallback(() => {
    const dc = dcRef.current;
    const ex = executorRef.current;
    if (!dc || dc.readyState !== 'open' || !ex) return;
    dc.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          // The GA API requires the session type on every update; without it the service answers
          // "Missing required parameter: 'session.type'" and closes the call (found by the
          // fake-microphone proof against production, 2026-09-02).
          type: 'realtime',
          tools: ex.tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.inputSchema })),
          tool_choice: 'auto',
        },
      }),
    );
  }, []);
  useEffect(() => {
    sendTools();
  }, [executor, sendTools]);

  const onEvent = useCallback(
    async (raw: string) => {
      let ev: RealtimeEvent;
      try {
        ev = JSON.parse(raw) as RealtimeEvent;
      } catch {
        return;
      }
      if (ev.type === 'response.output_audio_transcript.done' && typeof ev.transcript === 'string') {
        setSaid(ev.transcript);
        return;
      }
      if (ev.type === 'error') {
        stop('ended', ev.error?.message ?? 'The voice service reported an error.');
        return;
      }
      if (ev.type !== 'response.done') return;
      const items = ev.response?.output ?? [];
      const dc = dcRef.current;
      const ex = executorRef.current;
      if (!dc || !ex) return;
      let any = false;
      for (const item of items) {
        if (item.type !== 'function_call' || !item.name || !item.call_id) continue;
        any = true;
        let input: unknown = {};
        try {
          input = item.arguments ? JSON.parse(item.arguments) : {};
        } catch {
          input = {};
        }
        let output: string;
        try {
          output = await ex.execute(item.name, input, callsRef.current?.signal);
        } catch (e) {
          output = JSON.stringify({ ok: false, error: 'tool_failed', detail: e instanceof Error ? e.message : String(e) });
        }
        setCalls((n) => n + 1);
        if (dc.readyState === 'open') {
          dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output } }));
        }
      }
      if (any && dc.readyState === 'open') dc.send(JSON.stringify({ type: 'response.create' }));
    },
    [stop],
  );

  const start = useCallback(async () => {
    if (state === 'connecting' || state === 'live' || disabled) return;
    setState('connecting');
    setReason('');
    setSaid('');
    setCalls(0);
    callsRef.current = new AbortController();
    // 1. The microphone FIRST — a refusal must not spend a ticket (2026-09-02 review, P2-3).
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      stop('unavailable', 'The microphone was not allowed. Type to your assistant instead.');
      return;
    }
    micRef.current = mic;
    // 2. A short-lived secret from our own route (the key never comes here).
    let secret: string;
    let model: string;
    try {
      const r = await fetch('/api/voice/session', { method: 'POST' });
      const body = (await r.json()) as { value?: string; model?: string; detail?: string };
      if (!r.ok || typeof body.value !== 'string') {
        stop('unavailable', body.detail ?? 'Voice is not available right now.');
        return;
      }
      secret = body.value;
      model = body.model ?? 'gpt-realtime-2.1';
    } catch {
      stop('unavailable', 'Voice is not available right now.');
      return;
    }
    // 3. WebRTC to the Realtime API: our audio up, the agent's audio down, events on a data channel.
    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    pc.ontrack = (e) => {
      if (audioRef.current) audioRef.current.srcObject = e.streams[0] ?? null;
    };
    pc.addTrack(mic.getTracks()[0]!, mic);
    const dc = pc.createDataChannel('oai-events');
    dcRef.current = dc;
    dc.onmessage = (e) => void onEvent(String(e.data));
    dc.onopen = () => {
      setState('live');
      sendTools();
      capRef.current = window.setTimeout(() => stop('ended', 'Five minutes is the limit for one voice session. Start another if you need it.'), SESSION_CAP_MS);
    };
    dc.onclose = () => {
      if (pcRef.current === pc) stop('ended', '');
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') stop('ended', 'The voice connection dropped.');
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const r = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp ?? '',
      });
      if (!r.ok) {
        stop('unavailable', 'The voice service refused the connection.');
        return;
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() });
    } catch {
      stop('unavailable', 'The voice connection could not be made.');
    }
  }, [state, stop, onEvent, sendTools, disabled]);

  const live = state === 'live';
  return (
    <section className="cl-voice" aria-labelledby="cl-voice-head" data-clinic-voice={state} data-clinic-voice-calls={calls}>
      <div className="cl-voice__row">
        <div>
          <h2 id="cl-voice-head" className="cl-voice__head">
            Talk to Cedarfield
          </h2>
          <p className="cl-prose cl-voice__intro">
            The page’s own assistant, by voice — same tools, same rule: it cannot press; you do.
          </p>
        </div>
        {live || state === 'connecting' ? (
          <button type="button" className="cl-quiet" data-clinic-voice-stop onClick={() => stop('ended', '')}>
            End the call
          </button>
        ) : (
          <button
            type="button"
            className="cl-cta cl-cta--sm"
            data-clinic-voice-start
            data-clinic-voice-ready={ready === null ? 'checking' : ready.ok ? 'true' : 'false'}
            onClick={() => void start()}
            disabled={executor === null || disabled || ready?.ok === false}
          >
            Talk to Cedarfield
          </button>
        )}
      </div>
      <p className="cl-voice__status" role="status" data-clinic-voice-status>
        {disabled && state !== 'live' && state !== 'connecting'
          ? (disabledReason ?? 'Paused while the page is capturing above — one capture at a time.')
          : state === 'idle'
          ? ready === null
            ? 'Checking whether voice is set up on this deployment…'
            : ready.ok
              ? 'Voice is ready. Press the button, allow the microphone, and speak. It answers out loud.'
              : ready.reason || 'Voice is not set up on this deployment. Type to your assistant instead.'
          : state === 'connecting'
            ? 'Connecting…'
            : state === 'live'
              ? said === ''
                ? 'Listening. Say what you need — for example, “hold me the earliest appointment”.'
                : `It said: “${said}”`
              : reason !== ''
                ? reason
                : 'The voice session ended.'}
      </p>
      <audio ref={audioRef} autoPlay aria-hidden="true" />
    </section>
  );
}
