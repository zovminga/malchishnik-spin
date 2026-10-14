# 03: Maximum multi-device reset QA matrix

**What to build:** Playwright multi-context coverage proves the full intentional-reset matrix from the spec: dual clear/restart races, clear during an open Round, post-clear empty join, post-restart roster rebuild sync, Turn Player after clear, stale older generation cannot resurrect scores, and copy-link still usable. All new checks are wired into `test:qa` with isolated `?room=` ids; prior wipe/race suites stay green.

**Blocked by:** 02: Game Restart + reset UI contract

**Status:** claimed

- [ ] Dual Score Clear race → one coherent Room Generation, zeros everywhere, no score bounce
- [ ] Dual Game Restart race → empty Players everywhere
- [ ] Score Clear during an open Round closes the Round for all peers
- [ ] After Score Clear, a fresh empty join sees the cleared Room and does not restore pre-clear scores
- [ ] After Game Restart, adding Players on A appears on B with zero scores
- [ ] Score Clear preserves Player names/order; Turn Player is the first Player
- [ ] Stale award / thinner older Room Generation cannot resurrect scores after a clear (via public `Malchishnik` seam)
- [ ] Copy-link control still present and usable after the UI move
- [ ] New scripts use isolated `?room=` ids; never the live default party Room
- [ ] New checks are included in `npm run test:qa`; `test:wipe` and full `test:qa` pass
