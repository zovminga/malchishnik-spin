# 01: Score Clear sticks across devices via Room Generation

**What to build:** Score Clear bumps Room Generation so zeros and an empty night log stick for every phone in the Room and after refresh, while an empty join with the same Room Generation still cannot wipe a live party. An open Round is aborted for everyone. `Malchishnik.query` exposes `roomGeneration`. Existing wipe and QA suites stay green with helpers pointed at the new Score Clear control.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] Room Generation is part of Room state; missing/legacy values normalize to the lowest safe baseline
- [x] Score Clear zeroes scores, clears the night log, aborts any open Round, keeps Players and Places/Challenges, bumps Room Generation, and pushes immediately
- [x] MergePolicy: higher Room Generation wins even when Night Progress is thinner; equal Room Generation keeps Night Progress / open-Round rules (ADR-0001, ADR-0003, ADR-0005)
- [x] Peer B sees zeros and empty log live after Score Clear on A; refresh on A and B still shows the cleared Room
- [x] Empty-join wipe regression remains green (`test:wipe` / equivalent)
- [x] `Malchishnik.query` exposes `roomGeneration` (plus existing scores/history/round fields)
- [x] Stable Score Clear control id exists; shared QA helpers no longer depend on the old soft-reset button alone
- [x] `npm run test:wipe` and `npm run test:qa` pass

## Answer

Landed Room Generation (`roomGeneration`, baseline 0) on Room state + normalize. Score Clear (`#scoreClearBtn` / «Очистить баллы») zeros scores, clears history, aborts open Round, keeps Players/Places, bumps generation, pushes immediately. MergePolicy accepts higher generation even when thinner; equal generation keeps ADR-0001/0003. `Malchishnik.query.roomGeneration` + `scripts/qa-score-clear.mjs` (wired into `test:qa`); `qa-lib.resetGame` clicks `#scoreClearBtn`. Build 23. Hard-reset cache button left for ticket 02.
