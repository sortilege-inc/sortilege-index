# Tasks

Backlog for the Sortilege project index / coordination layer. This file is the
per-repo convention the dashboard aggregates: any `- [ ]` / `- [x]` checkbox line
becomes a task. Optional inline markers — `(p1)`..`(p3)` priority and `#tag` — are
parsed out; everything else here is just normal Markdown that renders on GitHub.

## Phase 2 — task queue

- [x] Define the TASKS.md convention and dogfood it here #phase2
- [x] Parse TASKS.md + derive standards-debt tasks in gen.mjs #phase2
- [ ] (p2) Roll out TASKS.md to the active repos so the queue reflects real work #phase2 #rollout
- [ ] (p3) Document the convention in the repo README #phase2 #docs

## Standards & CI

> Decided 2026-07-23: the `coverageAudit` gate can NOT run honestly in CI. It
> needs each book's source outline (`toc.txt`/HTML), which isn't committable
> (copyrighted source) and isn't fully trusted (toc.txt has known errors and
> omissions). With no source present the gate passes 0/0 — a false green, the
> exact thing the hard rule forbids. So coverage is not being automated.
> Fidelity assurance is a human job — see below.

- [ ] (p3) Add a LICENSE across the public repos #standards
- [ ] Optional later: structural-validation CI for DSL corpora (validator over `.ttrpg` only — honest and source-free; NOT coverage) #ci

## Fidelity validation (human — deferred, do not automate)

- [ ] (p2) Human validation program: check each corpus **sentence-by-sentence against its source PDF** — every statblock, spell, table, etc. Build alignment + resumable-ledger tooling WHEN this starts (per-corpus, beginning with the most-used corpus); the judgment stays human, no automated pass may mark it green. Not started. #validation #deferred

## Dashboard polish

- [ ] (p3) Consider a "stale backlog" signal when TASKS.md itself goes untouched #polish
- [ ] (p3) Let the Tasks tab deep-link via URL hash (e.g. #tasks?repo=caul) #polish
