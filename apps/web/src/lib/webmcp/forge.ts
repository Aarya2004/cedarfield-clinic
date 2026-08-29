/**
 * The forge engine: tools born at runtime from commands the human approved.
 *
 *   forge_create (agent) ─┐                         ┌─ registerTool('forged_<name>', {signal})
 *   "Forge this" (human) ─┴─► card ─► approve ──────┤   one AbortController per tool
 *                                                   └─ ledger row `forged` {hash}
 *   forged_<name>(params) ─► substitute ─► step 1 ghost-typed, steps 2..N queued ─► Enter … ─► stats
 *
 * Nothing here executes. Registration is the only side effect; every step still needs Enter.
 * Dependencies are injected so the engine is fully testable without a browser.
 */
import { getModelContext, type ModelContext } from './types.ts';
import { proposals as defaultStore, type Proposal, type ProposalStore, type DismissReason } from './proposals.ts';
import { getTerminalAdapter, type TerminalAdapter, type ResolvedProposal } from './adapter.ts';
import { ledger as defaultLedger, type Ledger } from './ledger.ts';
import { note } from './fieldnotes.ts';
import { isDangerousIn } from './schemas.ts';
import {
  FORGED_PREFIX,
  MAX_FORGED_VISIBLE,
  MAX_PENDING_CARDS,
  STATS_WINDOW,
  STEP_TIMEOUT_MS,
  coerceInput,
  contentHash,
  forgedDescription,
  forgedInputSchema,
  isMutating,
  substituteParams,
  validateForgeSpec,
  type ForgeError,
  type ForgeSpec,
} from './forge-spec.ts';

export interface ForgeCard {
  card_id: string;
  spec: ForgeSpec;
  origin: 'agent' | 'human';
  dangerous: boolean;
  kindOverridden: boolean;
  previousHash?: string;
  createdAt: number;
}

export type StepKind = 'machine' | 'native' | 'compiled' | 'planned';

export interface RunStat {
  t: string;
  invocation_id: string;
  step: number;
  exit_code: number | null;
  ms: number | null;
  /** where this step's answer came from (COMPOSE §2.2a); 'machine' when it was a plain shell command. */
  kind: StepKind;
  /** model calls this step spent: 0 for a replay/native-replay, null when unknown (first-run/planned). */
  calls: 0 | null;
}

export interface ForgedTool {
  name: string;
  tool: string;
  spec: ForgeSpec;
  hash: string;
  pinned: boolean;
  /** registered with the browser right now */
  visible: boolean;
  /** false when no WebMCP in this browser — tool tracked, never registered */
  registered: boolean;
  forgedAt: number;
  runs: number;
  stats: RunStat[];
}

export interface Invocation {
  invocation_id: string;
  tool: string;
  hash: string;
  proposal_ids: string[];
  activeIndex: number;
  startedAt: number;
  /** set by unforge() while the current step is already running: finish and record it, then stop */
  stopAfterCurrent?: boolean;
}

export interface ForgeListEntry {
  name: string;
  tool: string;
  kind: ForgeSpec['kind'];
  hash: string;
  pinned: boolean;
  visible: boolean;
  params: { name: string; description: string }[];
  runs: number;
  median_ms: number | null;
  last_exit: number | null;
  forged_at: string;
  /** the provenance kinds of the LAST invocation's steps, in order (COMPOSE §2.2a). */
  provenance: StepKind[];
  /** total model calls the last invocation spent — 0 when every step replayed, else null (unknown). */
  calls_last: number | null;
}

export interface InvokeResult {
  invocation_id: string;
  proposal_ids: string[];
  active: string;
  queued: number;
  hash: string;
}

export interface BusyResult {
  status: 'busy';
  active_invocation_id: string;
  proposal_ids: string[];
}

interface Internal extends ForgedTool {
  ac: AbortController | null;
  forgedAtIso: string;
}

export interface ForgeDeps {
  modelContext?: () => ModelContext | null;
  adapter?: () => TerminalAdapter;
  store?: ProposalStore;
  ledger?: Ledger;
  hash?: (spec: ForgeSpec) => Promise<string>;
  stepTimeoutMs?: number;
}

const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export class ForgeEngine {
  private cardList: ForgeCard[] = [];
  private toolMap = new Map<string, Internal>();
  private activeInv: Invocation | null = null;
  private invAc: AbortController | null = null;
  private listeners = new Set<() => void>();
  private readonly deps: Required<ForgeDeps>;

  constructor(deps: ForgeDeps = {}) {
    this.deps = {
      modelContext: deps.modelContext ?? getModelContext,
      adapter: deps.adapter ?? getTerminalAdapter,
      store: deps.store ?? defaultStore,
      ledger: deps.ledger ?? defaultLedger,
      hash: deps.hash ?? contentHash,
      stepTimeoutMs: deps.stepTimeoutMs ?? STEP_TIMEOUT_MS,
    };
  }

  // ---------- reads ----------

  cards(): ForgeCard[] {
    return this.cardList;
  }

  tools(): ForgedTool[] {
    return [...this.toolMap.values()].map(pub);
  }

  tool(name: string): ForgedTool | undefined {
    const t = this.toolMap.get(name);
    return t ? pub(t) : undefined;
  }

  active(): Invocation | null {
    return this.activeInv;
  }

  visibleCount(): number {
    return [...this.toolMap.values()].filter((t) => t.visible).length;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Definitions of the visible forged tools, for a second protocol (MCP relay); same shapes as WebMCP. */
  toolDefs(): { name: string; description: string; inputSchema: Record<string, unknown>; annotations: { readOnlyHint: boolean } }[] {
    return [...this.toolMap.values()]
      .filter((t) => t.visible)
      .map((t) => ({ name: t.tool, description: forgedDescription(t.spec), inputSchema: forgedInputSchema(t.spec), annotations: { readOnlyHint: t.spec.kind === 'read' } }));
  }

  list(): { visible: number; budget: number; tools: ForgeListEntry[] } {
    const tools = [...this.toolMap.values()]
      .sort((a, b) => a.forgedAt - b.forgedAt)
      .map((t) => {
        const last = t.stats.length ? t.stats[t.stats.length - 1] : null;
        const finals = t.stats.filter((s) => s.step === t.spec.commands.length - 1 && typeof s.ms === 'number').map((s) => s.ms as number);
        // The last invocation's step kinds, in step order, for the provenance chips.
        const lastInv = last ? t.stats.filter((s) => s.invocation_id === last.invocation_id).sort((a, b) => a.step - b.step) : [];
        const provenance = lastInv.map((s) => s.kind);
        const calls_last = lastInv.length && lastInv.every((s) => s.calls === 0) ? 0 : null;
        return {
          name: t.name,
          tool: t.tool,
          kind: t.spec.kind,
          hash: t.hash,
          pinned: t.pinned,
          visible: t.visible,
          params: t.spec.params.map((p) => ({ name: p.name, description: p.description })),
          runs: t.runs,
          median_ms: finals.length ? median(finals) : null,
          last_exit: last ? last.exit_code : null,
          forged_at: t.forgedAtIso,
          provenance,
          calls_last,
        };
      });
    return { visible: this.visibleCount(), budget: MAX_FORGED_VISIBLE, tools };
  }

  // ---------- cards ----------

  /** Content hash of a spec as it would be registered (the card shows it before approval). */
  hashOf(spec: ForgeSpec): Promise<string> {
    return this.deps.hash(spec);
  }

  openCard(input: unknown, opts: { origin: 'agent' | 'human' }): ForgeCard | ForgeError {
    const err = validateForgeSpec(input);
    if (err) return err;
    if (this.cardList.length >= MAX_PENDING_CARDS) return { error: 'too_many_pending', detail: `${MAX_PENDING_CARDS} cards already await the human` };
    const spec = normalise(input as ForgeSpec);
    const mutating = spec.commands.some(isMutating);
    const kindOverridden = spec.kind === 'read' && mutating;
    if (kindOverridden) spec.kind = 'write';
    const card: ForgeCard = {
      card_id: id('c'),
      spec,
      origin: opts.origin,
      dangerous: spec.commands.some((c) => isDangerousIn(c, this.deps.adapter().mode)),
      kindOverridden,
      ...(this.toolMap.has(spec.name) ? { previousHash: this.toolMap.get(spec.name)!.hash } : {}),
      createdAt: performance.now(),
    };
    this.cardList = [...this.cardList, card];
    void this.deps.ledger.append('forge_requested', { card_id: card.card_id, name: spec.name, origin: opts.origin, dangerous: card.dangerous, kind_overridden: kindOverridden });
    note('forge.card_opened', { origin: opts.origin, dangerous: card.dangerous });
    this.emit();
    return card;
  }

  reject(card_id: string): { ok: true } | ForgeError {
    const card = this.cardList.find((c) => c.card_id === card_id);
    if (!card) return { error: 'unknown_card' };
    this.cardList = this.cardList.filter((c) => c.card_id !== card_id);
    void this.deps.ledger.append('forge_rejected', { card_id, name: card.spec.name, decision_ms: Math.round(performance.now() - card.createdAt) });
    this.emit();
    return { ok: true };
  }

  async approve(card_id: string, edits?: Partial<ForgeSpec>, opts: { confirmDangerous?: boolean } = {}): Promise<ForgedTool | ForgeError> {
    const card = this.cardList.find((c) => c.card_id === card_id);
    if (!card) return { error: 'unknown_card' };
    const merged: ForgeSpec = normalise({ ...card.spec, ...(edits ?? {}) });
    const err = validateForgeSpec(merged);
    if (err) return err;
    if (merged.kind === 'read' && merged.commands.some(isMutating)) merged.kind = 'write';
    const dangerous = merged.commands.some((c) => isDangerousIn(c, this.deps.adapter().mode));
    if (dangerous && !opts.confirmDangerous) return { error: 'needs_confirmation', detail: 'a command matches a hard-blocked pattern; approve again to confirm' };
    const replacing = this.toolMap.get(merged.name);
    if (!this.budgetAllows(merged.name)) return { error: 'unpin_one', detail: `${MAX_FORGED_VISIBLE} forged tools are visible and all are pinned` };
    const hash = await this.deps.hash(merged);
    let t: Internal;
    try {
      t = await this.register(merged, hash, replacing);
    } catch (e) {
      note('forge.register_failed', { message: e instanceof Error ? e.message : String(e) });
      return { error: 'unsupported', detail: `registerTool failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    this.cardList = this.cardList.filter((c) => c.card_id !== card_id);
    void this.deps.ledger.append('forged', {
      name: t.name,
      tool: t.tool,
      hash,
      kind: merged.kind,
      commands: JSON.stringify(merged.commands),
      params: JSON.stringify(merged.params),
      previous_hash: replacing?.hash ?? null,
      origin: card.origin,
      decision_ms: Math.round(performance.now() - card.createdAt),
    });
    note('forge.approved', { decision_ms: Math.round(performance.now() - card.createdAt), replaced: !!replacing });
    this.emit();
    return pub(t);
  }

  // ---------- registration ----------

  private budgetAllows(name: string): boolean {
    const others = [...this.toolMap.values()].filter((t) => t.visible && t.name !== name);
    if (others.length < MAX_FORGED_VISIBLE) return true;
    return others.some((t) => !t.pinned);
  }

  private async register(spec: ForgeSpec, hash: string, replacing?: Internal): Promise<Internal> {
    if (replacing?.ac) {
      replacing.ac.abort();
      void this.deps.ledger.append('unregistered', { name: spec.name, hash: replacing.hash, reason: 'replaced' });
    }
    const t: Internal = {
      name: spec.name,
      tool: FORGED_PREFIX + spec.name,
      spec,
      hash,
      pinned: replacing?.pinned ?? false,
      visible: false,
      registered: false,
      forgedAt: performance.now(),
      forgedAtIso: new Date().toISOString(),
      // Stats belong to a content hash (identity). A re-forge that changes the command changes the
      // hash, so its runs/history must NOT carry over (Opus P2); an idempotent re-register (same hash) keeps them.
      runs: replacing && replacing.hash === hash ? replacing.runs : 0,
      stats: replacing && replacing.hash === hash ? replacing.stats : [],
      ac: null,
    };
    this.toolMap.set(spec.name, t);
    try {
      await this.registerWithBrowser(t);
    } catch (e) {
      // A rejected registerTool must not leave a phantom tool (Fable review P2).
      this.toolMap.delete(spec.name);
      if (replacing) this.toolMap.set(spec.name, { ...replacing, ac: null, visible: false, registered: false });
      throw e;
    }
    this.evictIfOver(t.name);
    return t;
  }

  private async registerWithBrowser(t: Internal): Promise<void> {
    const mc = this.deps.modelContext();
    const ac = new AbortController();
    t.ac = ac;
    t.visible = true;
    if (!mc) {
      t.registered = false;
      note('forge.register_skipped', { reason: 'no modelContext' });
      return;
    }
    const t0 = performance.now();
    try {
      await mc.registerTool(
        {
          name: t.tool,
          title: `Forged: ${t.name}`,
          description: forgedDescription(t.spec),
          inputSchema: forgedInputSchema(t.spec),
          annotations: { readOnlyHint: t.spec.kind === 'read' },
          execute: (input: unknown) => {
            if (ac.signal.aborted) return Promise.resolve({ error: 'unregistered' } as ForgeError);
            return Promise.resolve(this.invoke(t.name, coerceInput(input)));
          },
        },
        { signal: ac.signal },
      );
    } catch (e) {
      // A rejected registerTool must never leave a phantom visible-but-unregistered tool that `invoke`
      // would accept and the MCP relay would advertise (Fable P2). Roll back this tool's own flags; the
      // approve path also cleans the map, and restore() now returns an error instead of throwing.
      t.visible = false;
      t.registered = false;
      t.ac = null;
      throw e;
    }
    t.registered = true;
    note('forge.registered', { ms: Math.round(performance.now() - t0), tool: t.tool, kind: t.spec.kind });
  }

  private evictIfOver(keep: string): void {
    while (this.visibleCount() > MAX_FORGED_VISIBLE) {
      const victim = [...this.toolMap.values()]
        .filter((t) => t.visible && !t.pinned && t.name !== keep)
        .sort((a, b) => a.forgedAt - b.forgedAt)[0];
      if (!victim) return;
      this.unregister(victim, 'evicted');
    }
  }

  private unregister(t: Internal, reason: 'evicted' | 'unforged'): void {
    t.ac?.abort();
    t.ac = null;
    t.visible = false;
    t.registered = false;
    void this.deps.ledger.append('unregistered', { name: t.name, hash: t.hash, reason, age_ms: Math.round(performance.now() - t.forgedAt) });
    note('forge.unregistered', { reason, age_ms: Math.round(performance.now() - t.forgedAt) });
  }

  pin(name: string, pinned: boolean): { ok: true } | ForgeError {
    const t = this.toolMap.get(name);
    if (!t) return { error: 'unknown_tool' };
    t.pinned = pinned;
    void this.deps.ledger.append('pinned', { name, pinned });
    this.emit();
    return { ok: true };
  }

  unforge(name: string): { ok: true } | ForgeError {
    const t = this.toolMap.get(name);
    if (!t) return { error: 'unknown_tool' };
    if (this.activeInv?.tool === t.tool) {
      const inv = this.activeInv;
      const current = this.deps.store.get(inv.proposal_ids[inv.activeIndex]);
      if (current?.status === 'accepted') {
        // The human already pressed Enter: the command is running on the PTY. Let it finish and be
        // recorded (executed_step), drop only the queued steps (Codex review P1).
        inv.stopAfterCurrent = true;
        this.dismissFrom(inv, inv.activeIndex + 1, 'invocation_cancelled');
      } else this.cancelActive('invocation_cancelled'); // never leave a dead invocation holding `busy`
    }
    if (t.visible) this.unregister(t, 'unforged');
    this.toolMap.delete(name);
    this.emit();
    return { ok: true };
  }

  /** Re-register an evicted tool with the same (already approved) hash. */
  async restore(name: string): Promise<ForgedTool | ForgeError> {
    const t = this.toolMap.get(name);
    if (!t) return { error: 'unknown_tool' };
    if (t.visible) return pub(t);
    if (!this.budgetAllows(name)) return { error: 'unpin_one' };
    t.forgedAt = performance.now();
    try {
      await this.registerWithBrowser(t);
    } catch {
      return { error: 'unregistered' }; // registerWithBrowser already rolled back visible/registered
    }
    this.evictIfOver(name);
    void this.deps.ledger.append('restored', { name, hash: t.hash });
    this.emit();
    return pub(t);
  }

  // ---------- invocation ----------

  invoke(name: string, input: Record<string, unknown>): InvokeResult | BusyResult | ForgeError {
    const t = this.toolMap.get(name);
    if (!t) return { error: 'unknown_tool' };
    if (!t.visible) return { error: 'unregistered', detail: 'this forged tool was evicted; ask the human to restore it' };
    if (this.activeInv) return { status: 'busy', active_invocation_id: this.activeInv.invocation_id, proposal_ids: this.activeInv.proposal_ids };
    const t0 = performance.now();
    const sub = substituteParams(t.spec.commands, t.spec.params, input);
    if ('error' in sub) return sub;
    const invocation_id = id('inv');
    const store = this.deps.store;
    const adapter = this.deps.adapter();
    const n = sub.lines.length;
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const why = `${t.tool} · step ${i + 1}/${n}`;
      const opts = { queued: i > 0, invocation_id, step: i, dangerous: sub.dangerous[i] || isDangerousIn(sub.lines[i], adapter.mode) };
      const p: Proposal = i === 0 ? adapter.ghostType(sub.lines[i], why, opts) : store.propose(sub.lines[i], why, opts);
      ids.push(p.id);
    }
    this.activeInv = { invocation_id, tool: t.tool, hash: t.hash, proposal_ids: ids, activeIndex: 0, startedAt: t0 };
    this.invAc = new AbortController();
    void this.deps.ledger.append('invoked', { tool: t.tool, hash: t.hash, invocation_id, steps: n });
    note('forged.invoked', { tool: t.tool, steps: n, substitution_ms: Math.round((performance.now() - t0) * 100) / 100 });
    this.emit();
    void this.run(t, this.activeInv, this.invAc);
    return { invocation_id, proposal_ids: ids, active: ids[0], queued: n - 1, hash: t.hash };
  }

  private async run(t: Internal, inv: Invocation, ac: AbortController): Promise<void> {
    const store = this.deps.store;
    const adapter = this.deps.adapter();
    const ids = inv.proposal_ids;
    try {
      for (let i = 0; i < ids.length; i++) {
        inv.activeIndex = i;
        let p: ResolvedProposal | null = null;
        while (p === null && !ac.signal.aborted) {
          p = await adapter.waitProposal(ids[i], this.deps.stepTimeoutMs, ac.signal);
          if (p === null && !ac.signal.aborted) {
            // step timeout: the human never acted
            this.dismissFrom(inv, i, 'step_timeout');
            return;
          }
        }
        if (ac.signal.aborted) {
          this.dismissFrom(inv, i, 'invocation_cancelled');
          return;
        }
        if (p!.status === 'dismissed') {
          void this.deps.ledger.append('dismissed', { tool: t.tool, invocation_id: inv.invocation_id, step: i, reason: p!.reason ?? 'dismissed_by_human' });
          this.dismissFrom(inv, i + 1, 'dismissed_by_human');
          return;
        }
        const rk = p!.rokan;
        const kind: StepKind = rk?.native ? 'native' : rk ? (rk.replayed ? 'compiled' : 'planned') : 'machine';
        const stat: RunStat = { t: new Date().toISOString(), invocation_id: inv.invocation_id, step: i, exit_code: p!.exit_code ?? null, ms: p!.ms ?? null, kind, calls: rk?.replayed ? 0 : null };
        t.stats = [...t.stats, stat].slice(-STATS_WINDOW);
        if (i === 0) t.runs += 1; // a run counts once, when the first step actually executes (a human Enter) — not on invoke (Opus/Fable P2)
        // `executed_step`, not `executed`: the bridge owns `executed` (from OSC markers) and rejects it from clients.
        void this.deps.ledger.append('executed_step', {
          tool: t.tool,
          invocation_id: inv.invocation_id,
          step: i,
          exit_code: stat.exit_code,
          ms: stat.ms,
          ...(p!.rokan ? {
            rokan_ms: p!.rokan.ms,
            rokan_calls: p!.rokan.replayed ? 0 : null,
            ...(p!.rokan.native ? { rokan_site: p!.rokan.native.site, rokan_tool: p!.rokan.native.tool } : {}),
          } : {}),
        });
        if (typeof stat.exit_code === 'number' && stat.exit_code !== 0) {
          this.dismissFrom(inv, i + 1, 'prior_step_failed');
          return;
        }
        if (inv.stopAfterCurrent) return; // unforged while this step ran: recorded above, nothing more
        if (i + 1 < ids.length) store.promote(ids[i + 1]);
        this.emit();
      }
    } finally {
      if (this.activeInv?.invocation_id === inv.invocation_id) {
        this.activeInv = null;
        this.invAc = null;
      }
      note('forged.invocation_done', { tool: t.tool, ms: Math.round(performance.now() - inv.startedAt) });
      this.emit();
    }
  }

  private dismissFrom(inv: Invocation, from: number, reason: DismissReason): void {
    for (let j = from; j < inv.proposal_ids.length; j++) this.deps.store.resolve(inv.proposal_ids[j], 'dismissed', reason);
    if (from < inv.proposal_ids.length) void this.deps.ledger.append('dismissed', { tool: inv.tool, invocation_id: inv.invocation_id, from_step: from, reason });
  }

  /** Cancel the active invocation (e.g. bridge disconnected). */
  cancelActive(_reason: DismissReason = 'invocation_cancelled'): void {
    // Only abort. run()'s abort path dismisses the remaining steps and writes ONE `dismissed` row;
    // doing dismissFrom here too logged the same range twice (Fable P2).
    if (!this.invAc) return;
    this.invAc.abort();
  }

  dispose(): void {
    this.cancelActive();
    for (const t of this.toolMap.values()) if (t.visible) this.unregister(t, 'unforged');
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

function normalise(spec: ForgeSpec): ForgeSpec {
  return {
    name: spec.name,
    description: spec.description.trim(),
    commands: spec.commands.map((c) => c.trim()),
    params: (spec.params ?? []).map((p) => ({ name: p.name, description: p.description.trim(), example: p.example })),
    kind: spec.kind,
  };
}

function pub(t: Internal): ForgedTool {
  return {
    name: t.name,
    tool: t.tool,
    spec: t.spec,
    hash: t.hash,
    pinned: t.pinned,
    visible: t.visible,
    registered: t.registered,
    forgedAt: t.forgedAt,
    runs: t.runs,
    stats: t.stats,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export const forge: ForgeEngine = new ForgeEngine();
