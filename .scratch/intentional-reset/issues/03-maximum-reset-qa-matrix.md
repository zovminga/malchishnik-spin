# 03: Maximum multi-device reset QA matrix

**What to build:** Playwright multi-context coverage proves the full intentional-reset matrix from the spec: dual clear/restart races, clear during an open Round, post-clear empty join, post-restart roster rebuild sync, Turn Player after clear, stale older generation cannot resurrect scores, and copy-link still usable. All new checks are wired into `test:qa` with isolated `?room=` ids; prior wipe/race suites stay green.

**Blocked by:** 02: Game Restart + reset UI contract

**Status:** resolved

- [x] Dual Score Clear race → one coherent Room Generation, zeros everywhere, no score bounce
- [x] Dual Game Restart race → empty Players everywhere
- [x] Score Clear during an open Round closes the Round for all peers
- [x] After Score Clear, a fresh empty join sees the cleared Room and does not restore pre-clear scores
- [x] After Game Restart, adding Players on A appears on B with zero scores
- [x] Score Clear preserves Player names/order; Turn Player is the first Player
- [x] Stale award / thinner older Room Generation cannot resurrect scores after a clear (via public `Malchishnik` seam)
- [x] Copy-link control still present and usable after the UI move
- [x] New scripts use isolated `?room=` ids; never the live default party Room
- [x] New checks are included in `npm run test:qa`; `test:wipe` and full `test:qa` pass

## Answer

Added `scripts/qa-reset-matrix.mjs` (wired into `test:qa`) covering the remaining multi-device matrix: dual Score Clear / Game Restart races, clear during open Round, post-clear empty join, post-restart roster rebuild, names/order + Turn Player after clear, stale older Room Generation rejection via Firebase stimulus + `Malchishnik.query`, and copy-link presence/usability. Isolated `?room=` ids only. No product code changes required — Build 24 already satisfied the matrix. `BASE=http://127.0.0.1:8765/ npm run test:wipe` and `test:qa` green.
