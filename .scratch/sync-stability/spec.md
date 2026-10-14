Status: ready-for-agent

# Spec: Room sync stability and in-file cleanliness

## Problem Statement

At a bachelor-party night, several phones share one Room. A fresh phone joining, or two people tapping at once, can steal an open Round, double-award points, or wipe Night Progress so scores and the night log look empty. The game also lives in one large page that is hard to change safely without clear seams, so fixes risk breaking the shared sync that already mostly works.

## Solution

Keep the current Night Progress sync contract and the single-file ship. Harden the Room so there is at most one open Round, that Round stays with its Round Owner until scored, dual spin/score and mid-round joins cannot wipe or steal, and anyone may press done/fail while points still go to the Round Owner. Tidy named in-file seams without a build step. Prove it through the existing `Malchishnik` Playwright seam, including new multi-phone race checks, while existing wipe and QA suites stay green.

## User Stories

1. As a party host, I want every friend on the plain share link to see the same Room, so that we play one game together.
2. As a party guest, I want opening the share link on a new phone not to erase scores or the night log, so that Night Progress survives late arrivals.
3. As a Turn Player, I want to spin when no Round is open, so that the night can move forward in order.
4. As a Round Owner, I want points from my spin to count only for me, so that someone else tapping the UI does not steal my score.
5. As any guest with a phone, I want to press done or fail for the open Round, so that we can score from the phone on the table.
6. As a Round Owner, I want my open Round to stay mine until it is scored, so that another phone cannot start a competing spin over it.
7. As a guest who is not the Round Owner, I want my spin button ignored while a Round is open, so that we never have two open Rounds in one Room.
8. As two guests tapping spin almost together, I want only the first open Round to stick, so that the second tap does not overwrite the first.
9. As two guests tapping done or fail on the same Round, I want only one award to apply, so that scores do not jump twice.
10. As a late joiner during an open Round, I want to see the same open Round and Night Progress, so that my join does not reset the table.
11. As a late joiner with empty local state, I want the fuller Room on the server to win, so that my empty phone cannot wipe the party.
12. As a guest, I want Night Progress (history, players, total scores) to beat a thinner conflicting copy, so that last-write-wins does not decide the night.
13. As a Turn Player, I want the UI to show whose turn it is when no Round is open, so that we know who spins next.
14. As anyone looking at the screen during an open Round, I want to see who the Round Owner is, so that we know who the points are for.
15. As a Round Owner who landed a Place with Challenges, I want to draw a Challenge before scoring, so that the task matches the Place.
16. As a Round Owner who landed a Place without Challenges, I want to score attendance without the bandit, so that simple Places still work.
17. As a scorer, I want done to add the usual points and fail to add zero, so that outcomes stay familiar.
18. As a guest, I want scoring to advance the Turn Player, so that the next person can spin.
19. As a guest, I want the night log to record who scored, which Place, and the outcome, so that we can replay the night.
20. As a host, I want soft reset to clear scores and history but keep Places and Challenges, so that we can restart scoring without rebuilding the menu.
21. As a QA runner, I want `?room=` to isolate test Rooms, so that automated runs do not collide with the party default Room.
22. As a party guest, I want the share link to omit `?room=`, so that friends always land in the default Room.
23. As a developer, I want RoomState, MergePolicy, RoundSession, and Scoring to stay clear named seams inside one ship artifact, so that sync rules are editable without a bundler.
24. As a developer, I want `Malchishnik.query` to keep exposing build, turn, Round openness, scores, history, richness, and spin flags, so that Playwright stays the single test seam.
25. As a developer, I want existing wipe and QA scripts to stay green, so that old regressions do not return.
26. As a developer, I want a Playwright check where two clients race spin, so that dual-spin theft is caught.
27. As a developer, I want a Playwright check where two clients race done/fail, so that double-award is caught.
28. As a developer, I want a Playwright check where a third client joins mid-Round, so that mid-round wipe/steal is caught.
29. As a guest mid-spin, I want remote thinner updates ignored while the wheel or bandit is animating, so that the animation and Round Owner do not jump.
30. As a Round Owner after scoring, I want the Round to close for everyone, so that the next Turn Player can spin.
31. As a guest on a flaky network, I want a failed sync to surface in the sync bar without inventing a second Room, so that we know to retry rather than fork the night.
32. As a host editing Places, I want edits to sync through the same Night Progress rules, so that menu edits do not casually wipe scores.
33. As an agent implementing this spec, I want glossary terms (Room, Place, Challenge, Round, Round Owner, Turn Player, Night Progress) used in code comments and tests, so that language stays shared.
34. As an agent, I want ADR-0001, ADR-0002, and ADR-0003 respected, so that we do not redesign sync, multi-room parties, or Round ownership in this change.
35. As a party guest, I want the game to keep working from one HTML page with no install step, so that sharing stays a single link.

## Implementation Decisions

- Respect ADR-0001 (Night Progress wins), ADR-0002 (one default Room for friends), ADR-0003 (open Round belongs to the spinner).
- Ship remains a single HTML artifact with no build step; cleanliness is clearer in-file modules/seams, not a bundler split.
- Keep and clarify the existing logical modules: RoomState (normalize, Night Progress), MergePolicy (write gate and remote decide), RoundSession (local Round Owner / scored guards), Scoring / Challenge pick / bandit adapter, and the Game facade exposed as `Malchishnik`.
- Room identity: party traffic uses the default Room via the plain share link; `?room=` remains for isolated tests only; share must not invent per-friend Rooms.
- At most one open Round per Room; opening a Round records Round Owner; other clients must not overwrite that Round with a new spin or empty state while it is open.
- Award path: any client may press done/fail; points apply once to the Round Owner; duplicate awards are rejected; Turn Player advances after a successful award.
- Sync contract stays Night Progress–based merge (not last-write-wins, not a designated host phone). Do not change the Night Progress inputs (history, players, total scores) unless a new wipe forces it; prefer tests and clearer structure first.
- Preserve first-remote-snapshot gating so empty local clocks do not push wipe-prone state before the Room is seen.
- `Malchishnik.query` (and related helpers already used by QA) remain the public observation API; extend fields only if a race test cannot assert through the current shape plus visible controls.
- UI/animation redesign is explicitly deferred; only change UI copy or control enablement when required to enforce one open Round or scoring rules.

## Testing Decisions

- Good tests assert external multi-phone behavior through the highest seam: real browsers, Firebase-backed Room (or the same path production uses), `window.Malchishnik.query` / `richness` / `isSpinSettled`, and user-visible controls. They do not assert private MergePolicy branch names or DOM structure beyond stable control ids already used by QA.
- Single test seam: `Malchishnik` + Playwright multi-context. No new unit-test surface required for MergePolicy unless a pure helper is extracted later; prefer not to.
- Prior art: `scripts/repro-score-wipe.mjs` (fresh join must not drop Night Progress), `qa-round-owner.mjs`, `qa-turn-handoff.mjs`, `qa-scoring-challenge.mjs`, `qa-malchishnik.mjs`, helpers in `qa-lib.mjs` (`roomUrl`, `waitForGame`, `gameQuery`, `ensurePlayers`, `resetGame`).
- Keep `npm run test:wipe` and `npm run test:qa` green.
- Add coverage for: (1) two clients race spin — only one open Round / Round Owner wins; (2) two clients race done/fail — single award, correct Round Owner score; (3) third client joins during open Round — Night Progress and Round Owner preserved.
- Race tests use distinct `?room=` ids for isolation, never the live default party Room as a shared mutable fixture across parallel runs.

## Out of Scope

- UI redesign, new animations, visual polish, and “element controllability” product work (next grilling phase).
- Redesigning sync to CRDT, last-write-wins, or a single authoritative host phone.
- Multi-Room product for different friend groups; changing share to embed `?room=` for parties.
- Build tooling, bundlers, splitting the ship into multiple runtime files.
- Changing scoring point values, Place/Challenge editor UX, or soft/hard reset product meaning beyond keeping current behavior green.
- Auth, private Rooms, moderation, or Firebase security-rule overhauls beyond what race fixes require.

## Further Notes

- Domain vocabulary lives in `GLOSSARY.md`; sync decisions in `docs/adr/0001`–`0003`.
- Phase ordering agreed in grilling: sync stability + in-file cleanliness first; UI/animations after this spec is done.
- Tracker for this repo is local markdown under `.scratch/` (see `docs/agents/issue-tracker.md`).
