# Licensing registry

Authoritative record of how every tracked Sortilege repository is licensed.
The machine-readable source of truth is the `license` field on each project in
[`catalog.json`](catalog.json); this document is the human-readable companion.
`gen.mjs` treats a declared license (or a GitHub-detected SPDX license) as
satisfying the License standard, so proprietary/`NOTICE` repos GitHub can't
auto-detect still count as licensed on the dashboard.

Applied 2026-07-23 via the GitHub API, committed as Jordan Peacock
<jordan@sortilege.online>.

## MPL-2.0 — `LICENSE` (canonical Mozilla Public License 2.0)

Own code, open source.

`titterpig-mastra`, `titterpig-synthesist`, `titterpig-dsl`,
`titterpig-rules-lawyer`, `titterpig-engine`, `titterpig-dashboard-web`,
`marginalia`

## GPL-3.0 — pre-existing, kept

`sublime-ttrpg-syntax` — already carried GPL-3.0; left as its original license.

## CC-BY-4.0 — `LICENSE` (canonical Creative Commons Attribution 4.0)

`titterpig-dsl-dnd5.5e` — matches the SRD 5.2.1 source license.

## Per-file — `NOTICE`

Licensing is defined per file; the `NOTICE` explains this. **To-do (deferred):
embed license/copyright headers in each file** (tracked in [`TASKS.md`](TASKS.md)).

`titterpig-dsl-callofcthulhu7e`, `titterpig-dsl-root`, `titterpig-dsl-daggerheart`,
`titterpig-dsl-dnd5e`, `titterpig-dsl-arm5e`, `titterpig-dsl-vtm5e`,
`titterpig-dsl-draw-steel`, `titterpig-dsl-l5r5e`, `titterpig-dsl-tor2e`,
`titterpig-dsl-invisiblesun`, `titterpig-dsl-expanse`,
`titterpig-dsl-dnd5e-3rdparty`, `titterpig-dsl-l5r5e-3rdparty`

## Proprietary — `LICENSE` (Copyright © 2026 Sortilege, all rights reserved)

Non-campaign: `sortilege-index`, `un-coup-de-des`, `dossiers`,
`hope-fear-mythic-greece`, `9e`, `bse`, `bse-web`, `sortilege.online`, `ragtime`,
`exquisite-shade`, `situation-normal`, `hegemonyccg`, `networked-futures`

Campaigns (same, plus a line noting third-party game-system content remains its
publishers'): `sjorseidr`, `caul`, `a-gibbous-moon`, `war-of-princes`,
`children-of-fear`, `home-is-where-we-make-our-fire`, `arcs-2026`

## Proprietary — `LICENSE` (Copyright © 2026 Soren Peacock, all rights reserved)

Wholly Soren's content: `gotd`, `gods-of-the-dead`

## Publisher-owned — `NOTICE`

Game content copyrighted by respective publishers; unofficial Foundry aids, not
for redistribution. `sortilege-fvtt-compendia-l5r5e`,
`sortilege-fvtt-compendia-marvel-multiverse`, `l5r5e-compendia-sortilege`,
`sortilege-fvtt-compendia-vtm5e`

## CC0-1.0 — pre-existing, kept

`bse-archive` — already CC0 (public-domain dedication); left as-is.

## MIT — pre-existing, kept

`react-hexgrid` — MIT (fork of the MIT-licensed library); left as-is.

## TBD — licensing not yet decided

Still surface an "Add a LICENSE" task on the dashboard until decided:
`bellum-arborem`, `banes-of-beleriand`, `collateral`, `istya`,
`intertwingler-l5r-wiki`, `dossier-studio`, `quorum`, `spiders-game`,
`makers-matrix`, `makers-matrix-api`, `tcggg`, `tcgdb`, `snafu-db`
