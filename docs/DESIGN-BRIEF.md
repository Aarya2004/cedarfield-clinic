# DESIGN BRIEF — terminal-first workspace (wayfinder map #1, tickets #2–#9)

> **Historical — pre-pivot.** This document describes *Rokan Terminal*, which now lives at
> `/terminal` and is not the submitted product. The submission is **The Drop** — start at
> [`docs/README.md`](README.md).

Subject: a forge for tools — a terminal where approved work becomes permanent, agent-callable
tools. The page's single job: let a human and an agent work one terminal together and *watch
tools get born*. Audience: developers + seven hackathon judges skimming fast.

## Direction (one sentence)
Rokan by day is warm paper and ink; **Rokan by night is iron and embers** — the dark theme reads
as the same brand after the forge is lit, not as a generic dark mode.

## Tokens
Light (locked brand, unchanged): bg #fafaf6 · ink #18181b · accent #d97706 · accent-ink #b45309 ·
muted #62626b · line #e4e4e0 · surface #ffffff · ok #047857 · danger #b91c1c.

Dark (forge): bg **#191714** (warm iron near-black, never slate) · surface **#201d19** ·
ink **#ede8df** (warm paper-white) · muted **#a39c8f** · line **#322e28** ·
accent **#d97706** (fills/borders) · accent-ink **#f0a648** (text-on-dark amber, ≥4.5:1 on bg) ·
ok **#4cc38a** · danger **#f16a5f**.

Terminal canvas (BOTH themes, pinned): **#12100e** bg, #ede8df fg, amber cursor, warm ANSI ramp.
The terminal is the forge floor — it never goes light.

Mechanism: CSS vars on `:root` (dark = default), `[data-theme="light"]` overrides; toggle in the
status bar; persisted `localStorage['rokan-theme']`; **system preference is not consulted** —
first paint is dark for every visitor (the judge/demo frame), and honouring a light system pref
would repaint after hydration, the exact flash the dark CSS default prevents. No inline theme
script (nonce CSP); choosing light applies post-hydration and persists.

## Type (locked by stack)
Instrument Serif = display (headline, pane titles as small caps? no — titles stay Geist; serif is
for the thesis and section identity only, used with restraint). Geist Sans = body. Geist Mono =
all data: commands, hashes, ms, exit codes. Type scale: 38px serif hero → 15px body → 12px data →
11px chrome.

## Layout (ticket #3)
Main column = the work: collapsing hero → run feed (DOM, scrollable, the history) → live xterm
docked beneath (always dark). Right rail = the state: Tools · Forge · Ledger, compact. Status bar
spans the top with brand + session chips + theme toggle.

## Signature (spend the boldness here, nowhere else)
**The birth pulse**: when a tool registers at runtime, one amber pulse traces from its origin (the
run-feed entry / forge card) to the Tools rail entry, which arrives already glowing and cools over
~2 s. One orchestrated moment; everything else is still. `prefers-reduced-motion` gets a static
amber highlight instead.

## Guardrails
- Quality floor: keyboard focus visible (amber ring exists), reduced motion respected, honest
  empty states written as invitations (see current copy voice), AA contrast documented in
  globals.css comments per token.
- Every measured number on screen stays measured (§0.6) — design never invents a value.
- Preserve every `data-*` attribute; the CDP harness drives the real UI.
- Copy: active voice, sentence case, name things by what the user controls ("Share screen",
  "Forge this"), never by internals.
