Status: ready-for-agent

# Spec: Intentional Score Clear and Game Restart

## Problem Statement

Friends share one Room on one link. The host presses the current reset and sees zeros on that computer, but after refresh the old scores come back, and phones still show the old Night Progress. Soft reset looks like an accidental wipe to the sync rules, so the Room rejects it. The single «Обнулить игру» control also cannot express two different intents: clear scores for another round with the same people, versus restart the night with no players left on the list.

## Solution

Replace the old soft-reset control with two intentional actions — **Score Clear** and **Game Restart** — shown as smaller buttons at the bottom. Keep the single-page Firebase ship. Add **Room Generation** so an intentional clear/restart always sticks for every device and after refresh, while an empty new phone still cannot wipe a live party when Room Generation matches. Remove the local «сброс кэша» control so party-wide clears only go through these two actions. Prove the behaviour with maximum Playwright multi-device coverage on the existing `Malchishnik` seam, and keep wipe/race QA green.

## User Stories

1. As a party host, I want a Score Clear action, so that everyone can start a fresh scoring stretch without rebuilding the player list.
2. As a party host, I want Score Clear to set every player's score to zero, so that the scoreboard is clean.
3. As a party host, I want Score Clear to clear the night log, so that old awards do not clutter the next stretch.
4. As a party host, I want Score Clear to abort any open Round, so that nobody is stuck mid-spin scoring.
5. As a party host, I want Score Clear to keep the player list, so that we do not retype names.
6. As a party host, I want Score Clear to keep Places and Challenges, so that the night menu stays intact.
7. As a party host, I want a Game Restart action, so that we can wipe the table back to “no players yet” without rebuilding Places.
8. As a party host, I want Game Restart to do everything Score Clear does and also remove every player, so that a new cast can join.
9. As a guest on another phone, I want Score Clear on one device to show zeros on mine without refreshing, so that the Room stays one game.
10. As a guest on another phone, I want Game Restart on one device to show an empty player list on mine, so that we all see the same restart.
11. As anyone who refreshed after Score Clear, I want zeros and an empty log to remain, so that refresh does not resurrect old scores.
12. As anyone who refreshed after Game Restart, I want the empty player list to remain, so that restart survives reload.
13. As a late joiner with an empty phone, I want joining a live Room not to erase Night Progress when Room Generation matches, so that accidental wipe stays blocked.
14. As a late joiner after Score Clear, I want to see the cleared scores and log (not the pre-clear Night Progress), so that I join the current generation of the Room.
15. As a guest, I want a higher Room Generation to beat a lower one even when Night Progress is thinner, so that intentional clears are not rejected as wipes.
16. As a guest, I want equal Room Generation to keep Night Progress rules, so that ADR-0001 still protects the party between clears.
17. As any guest on the share link, I want to run Score Clear or Game Restart, so that we do not need a host role or login.
18. As a guest, I want a confirm before Score Clear, so that a mis-tap does not zero the board.
19. As a guest, I want a different confirm before Game Restart, so that removing players is obviously heavier than clearing scores.
20. As a guest who cancels either confirm, I want the Room unchanged, so that cancel is a true no-op.
21. As a guest, I want the old «Обнулить игру» button gone, so that there is only one clear vocabulary.
22. As a guest, I want the «сброс кэша» control gone, so that local cache tricks are not confused with party-wide reset.
23. As a guest, I want Score Clear and Game Restart as smaller controls near the bottom, so that copy-link stays the primary top action.
24. As a Turn Player after Score Clear, I want turn order to start from the first remaining player, so that the next spin has a clear owner.
25. As a guest after Game Restart with no players, I want spin to wait until someone is added, so that we do not score as Guest by accident.
26. As a Round Owner mid-open Round, I want Score Clear from any phone to close that Round for everyone, so that generation advance does not leave a ghost Round.
27. As two guests tapping Score Clear nearly together, I want one winning generation and zeros everywhere, so that old scores do not bounce back.
28. As two guests tapping Game Restart nearly together, I want one empty player list everywhere, so that restart does not partially apply.
29. As a host after Game Restart, I want Places and Challenges unchanged on every phone, so that the menu survives the restart.
30. As a host after Score Clear, I want player names and order preserved on every phone, so that only scores and log reset.
31. As a QA runner, I want `?room=` isolation for reset tests, so that runs never touch the default party Room.
32. As a developer, I want `Malchishnik.query` to expose `roomGeneration` plus scores, history, round openness, and richness, so that Playwright can assert without scraping merge internals.
33. As a developer, I want stable control ids for Score Clear and Game Restart, so that helpers do not depend on Russian label text alone.
34. As a developer, I want existing `test:wipe` and `test:qa` suites to stay green, so that prior sync wins do not regress.
35. As a developer, I want multi-context Playwright coverage for clear/restart across peers, refresh, empty join, open-Round clear, dual-clear races, cancel no-op, and places preserved, so that multi-device use is actually proven.
36. As a party guest, I want the product to stay one HTML page on the share link with Firebase, so that we do not need a new server install.
37. As an agent implementing this, I want glossary terms (Room, Player, Night Progress, Room Generation, Score Clear, Game Restart, Round, Turn Player) and ADR-0001/0002/0003/0004/0005 respected, so that language and sync contracts stay shared.
38. As a guest editing Places, I want Score Clear / Game Restart not to delete Places or Challenges, so that menu edits and resets stay separate jobs.
39. As a guest, I want copy-link to keep working after the button move, so that sharing the Room stays one tap.
40. As a scorer, I want a stale in-flight award from an older Room Generation not to resurrect scores after a clear, so that generation truly ends the previous stretch.

## Implementation Decisions

- Respect ADR-0001 (Night Progress wins when Room Generation matches), ADR-0002 (one default Room for friends), ADR-0003 (open Round belongs to the spinner), ADR-0004 (roster removal keeps Night Progress; does not bump Room Generation), ADR-0005 (intentional reset via Room Generation).
- Ship remains a single HTML artifact with Firebase RTDB; no new backend, WebSocket layer, CRDT, or bundler.
- Extend Room state with a monotonic Room Generation value, defaulting missing/legacy data to a safe baseline (treat absent as the lowest generation).
- Score Clear and Game Restart are the only user actions that bump Room Generation.
- MergePolicy: higher Room Generation always accepts the write / apply path even when Night Progress is thinner; equal Room Generation keeps today’s Night Progress and open-Round defenses.
- Score Clear: zero all scores, clear history, abort open Round / local RoundSession, keep players, keep Places/Challenges, set Turn Player to the first player when any remain, bump Room Generation, push immediately.
- Game Restart: same as Score Clear, plus empty the player list and clear Turn Player / active index appropriately for zero players, bump Room Generation, push immediately.
- UI: remove «Обнулить игру» and «сброс кэша»; add compact «Очистить баллы» and «Перезапустить игру» near the bottom; keep copy-link as the primary top action; distinct confirm copy for each action.
- Anyone on the share link may run either action (no host role).
- Keep named in-file seams: RoomState (normalize + Night Progress + Room Generation), MergePolicy (write gate + remote decide), RoundSession, Scoring, Game/`Malchishnik` facade.
- Expose `roomGeneration` on `Malchishnik.query`; add stable button ids for the two actions; update shared QA helpers that previously clicked the old reset control.
- Do not redesign scoring point values, Place/Challenge editor, Groom Salute, or share-link Room identity.

## Testing Decisions

- Good tests assert external multi-device Room behaviour: real browsers, Firebase-backed isolated `?room=` Rooms, `window.Malchishnik.query` / `richness` / `isSpinSettled`, and stable control ids. They do not assert private MergePolicy branch names, CSS compactness, or exact confirm string wording beyond cancel = no-op.
- Single test seam: `Malchishnik` + Playwright multi-context. No new unit-test surface for MergePolicy required.
- Prior art: `scripts/repro-score-wipe.mjs`, `qa-dual-spin.mjs`, `qa-dual-award.mjs`, `qa-mid-round-join.mjs`, helpers in `qa-lib.mjs` (`roomUrl`, `waitForGame`, `gameQuery`, `ensurePlayers`, old `resetGame`).
- Keep `npm run test:wipe` and `npm run test:qa` green after helpers point at the new controls.
- Maximum coverage for this feature (separate QA scripts and/or one orchestrated suite, still isolated rooms):
  1. Score Clear on A → zeros and empty log on B live; refresh A and B still zeros.
  2. Game Restart on A → empty players on B live; refresh A and B still empty players; Places/Challenges preserved.
  3. After Score Clear, a fresh empty join sees the cleared Room and does not restore pre-clear scores.
  4. Regression: live Night Progress + empty join with equal Room Generation does not wipe scores (`test:wipe` / equivalent).
  5. Score Clear during an open Round closes the Round for all peers.
  6. Dual Score Clear race → one coherent generation, zeros everywhere, no score bounce.
  7. Dual Game Restart race → empty players everywhere.
  8. Cancel confirm on either action → Room unchanged.
  9. Score Clear preserves player names/order; Turn Player returns to the first player.
  10. After Game Restart, adding players on A appears on B with zero scores.
  11. Stale award / thinner older generation cannot resurrect scores after a clear (where automatable through the public seam).
  12. Copy-link control still present and usable after the UI move.
- Race/isolation tests use distinct `?room=` ids, never the live default party Room as a shared mutable fixture.

## Out of Scope

- New server, auth, private Rooms, host roles, or Firebase security-rule overhauls beyond what Room Generation requires.
- CRDT / last-write-wins redesign of ordinary edits.
- Visual redesign beyond moving/splitting the reset controls (no hero/layout overhaul).
- Changing Place/Challenge content, scoring point values, Groom Salute, or share-link behaviour.
- Splitting the ship into multiple runtime files or adding a bundler.
- Restoring or reinventing «сброс кэша».

## Further Notes

- Root cause of the reported bug: intentional soft reset lowers Night Progress, so ADR-0001 MergePolicy rejects the write; peers and refresh reload the richer pre-reset Room. Room Generation is the deliberate exception for Score Clear / Game Restart only.
- Domain language and ADR-0005 were settled in grill-with-docs before this spec; implementers should treat those as binding.
- After tickets are cut, prefer blockers-first tracer bullets: generation+merge+Score Clear proven multi-device first, then Game Restart/UI split polish, then the remaining maximum matrix — without leaving wipe regressions red.
