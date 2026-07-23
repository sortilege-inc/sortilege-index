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

## Phase 3 — CI standards enforcement

- [ ] (p1) Author a shared reusable workflow: coverageAudit + validators gate #phase3 #ci
- [ ] (p2) Adopt the reusable workflow across the 14 DSL corpora #phase3 #ci #coverage
- [ ] (p3) Add a LICENSE across the public repos #phase3 #standards

## Dashboard polish

- [ ] (p3) Consider a "stale backlog" signal when TASKS.md itself goes untouched #polish
- [ ] (p3) Let the Tasks tab deep-link via URL hash (e.g. #tasks?repo=caul) #polish
