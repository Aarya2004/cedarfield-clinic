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
