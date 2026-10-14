# 01: Score Clear sticks across devices via Room Generation

**What to build:** Score Clear bumps Room Generation so zeros and an empty night log stick for every phone in the Room and after refresh, while an empty join with the same Room Generation still cannot wipe a live party. An open Round is aborted for everyone. `Malchishnik.query` exposes `roomGeneration`. Existing wipe and QA suites stay green with helpers pointed at the new Score Clear control.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Room Generation is part of Room state; missing/legacy values normalize to the lowest safe baseline
- [ ] Score Clear zeroes scores, clears the night log, aborts any open Round, keeps Players and Places/Challenges, bumps Room Generation, and pushes immediately
- [ ] MergePolicy: higher Room Generation wins even when Night Progress is thinner; equal Room Generation keeps Night Progress / open-Round rules (ADR-0001, ADR-0003, ADR-0005)
- [ ] Peer B sees zeros and empty log live after Score Clear on A; refresh on A and B still shows the cleared Room
- [ ] Empty-join wipe regression remains green (`test:wipe` / equivalent)
- [ ] `Malchishnik.query` exposes `roomGeneration` (plus existing scores/history/round fields)
- [ ] Stable Score Clear control id exists; shared QA helpers no longer depend on the old soft-reset button alone
- [ ] `npm run test:wipe` and `npm run test:qa` pass
