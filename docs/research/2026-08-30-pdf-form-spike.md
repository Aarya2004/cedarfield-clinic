# Spike — "Fill Together" feasibility: can a page turn a real government PDF's fields into tools? (2026-08-30 ~13:00 PT, Engineer #4, ~40 min)

Tooling: pdf-lib 1.17.1 (write) and pdfjs-dist 4.10.38 (read) in Node; same libraries run in the browser.

| Form | Fetch | pdf-lib (write) | pdf.js (read) | Labels |
|---|---|---|---|---|
| IRS W-9 (`fw9.pdf`) | 200 | **23 fields** (15 text, 8 checkbox); XFA layer stripped, AcroForm editable | 23 widgets | **none** — names opaque (`f1_01[0]`), no TU/alternativeText; nearest-text heuristic gives fragments |
| IRS 1040 (`f1040.pdf`) | 200 | **199 fields** | 229 objects | none |
| USCIS I-765 | 200 | **fails to parse** ("Expected instance of PDFDict") — XFA-primary | 180 objects, XFA=true | **161/161 widgets labelled** ("Part 2. Information About You… Enter Family Name") |
| USCIS N-400 | 200 | fails (same) | — | (labelled, same family) |
| SSA-16, SSA-827 | **403 / HTML** (bot wall to curl) | — | — | — |
| CRA T2201 / T1-ADJ | **000** (canada.ca blocks curl; URLs unverified) | — | — | — |

**Reading:** feasibility is per publisher, not general. The writable forms (IRS) have no labels; the labelled forms
(USCIS) are XFA and pdf-lib cannot open them (qpdf/mutool not installed; a WASM PDF engine would be a day of
plumbing). "Drop any PDF" is an over-claim; the honest scope is "these N forms", each hand-checked. A pivot to
this concept spends day 1 on PDF plumbing before any WebMCP work exists. No CRA/SSA form was verifiable from
this machine without a browser.

**Correction (evaluator re-test, same hour):** the parse failures above are a *stock pdf-lib 1.17.1* limitation
(unmaintained since 2021-11; no encrypted/XFA-hybrid support). **`@cantoo/pdf-lib@2.9.1` (2026-08-18) with
`{password: ''}` opens and round-trips every hybrid form tested** — CRA T2201 (296 fields, 529 ms), Ontario ODSP
Mandatory Special Necessities (129), USCIS I-765 (161), I-90 (195), VA 21-526EZ (345) — and pdf.js 6.3 can fill +
`saveDocument()` alone. **Dynamic XFA** (Ontario ODSP main 006-0983E, Alberta AISH DS2444A/B) has zero widgets:
no browser library can fill it; triage on `/NeedsRendering`. Landmines: `Required`/`ReadOnly` flags are 0 on all
11 forms (required-ness lives in the discarded XFA layer → hand-curated per form); `setText()` throws on
maxLength overflow (VA form: 120 of 292 text fields have maxLength < 8); standard fonts are WinAnsi — non-Latin
names crash at `save()` unless a Unicode TTF is embedded; never `flatten()` (signature widgets abort it). Best
demo form: USCIS I-9 (native AcroForm, 128 fields, human-readable names). **So feasibility is fine; what kills
the concept is prior art**: SimplePDF's WebMCP demo (in the public directory since 2026-05-02, `get_fields /
set_field_value / focus_field / submit`), `auto-webmcp-chrome` (15★, agent fills 27 fields, human controls
submit), `public-service-passport` ("tell it once, reuse it safely" for benefits). Creativity 3–4.
Also: `navigator.modelContext` was **removed in Chrome 152**; our `types.ts` resolves `document ?? navigator`.
