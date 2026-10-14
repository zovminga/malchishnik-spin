Status: ready-for-agent

# Spec: Groom Salute and light control polish

## Problem Statement

When the wheel hits JACKPOT, the party already gets a flash banner and colored sparks, but nothing that feels like the groom. Friends want a short, funny burst of his icons (football, cat Zvyrk, Jesus) flying like confetti. Spin, bandit, and score controls should also stay clearly usable so the celebration does not make the table harder to play.

## Solution

Add a **Groom Salute**: a short JACKPOT-only burst of the three groom stickers, visible to everyone currently watching the Room. Keep the single-page ship and Night Progress sync rules. Lightly polish control clarity (spin / bandit / score) so the night stays easy to drive. Prove the salute through the existing `Malchishnik` Playwright seam without breaking wipe and race QA.

## User Stories

1. As a party guest, I want a Groom Salute when the wheel hits JACKPOT, so that the win feels like our friend’s night.
2. As a party guest, I want the salute to use the football, ginger-and-white Zvyrk, and Jesus-face stickers, so that the jokes land.
3. As a Turn Player spinning, I want the salute only at JACKPOT (not the whole spin), so that the wheel stays readable while it turns.
4. As a guest on another phone in the same Room, I want to see the same JACKPOT salute when someone lands, so that we celebrate together.
5. As a guest, I want the salute short (~12–20 pieces, about one second), so that it does not hide the landed Place.
6. As a guest, I want the old colored sparks able to coexist or be replaced cleanly by sticker pieces, so that the screen does not become a mess of two competing bursts.
7. As a Round Owner, I want spin / bandit / score controls still easy to find after the salute, so that we can finish the Round.
8. As a Turn Player, I want it obvious when I can press spin, so that we do not argue whose turn it is.
9. As a guest using the bandit, I want it clear whether a Challenge is still rolling or already picked, so that we know when to score.
10. As any guest scoring, I want done/fail easy to see when a Round is open, so that points get entered from the phone on the table.
11. As a late watcher, I want joining mid-salute not to break Night Progress or Round Owner, so that sync stays solid.
12. As a guest on a slow phone, I want the salute to finish and clean up its nodes, so that the page does not fill with leftover stickers.
13. As a host, I want the default Room share link unchanged, so that friends still open one game.
14. As a QA runner, I want `?room=` isolation for salute tests, so that runs do not collide.
15. As a developer, I want sticker assets shipped with the product, so that the salute works offline from CDN extras.
16. As a developer, I want `Malchishnik.query` to expose whether a Groom Salute recently fired (or is active), so that Playwright can assert without scraping CSS guts.
17. As a developer, I want existing wipe, dual-spin, dual-award, and mid-round-join suites to stay green, so that phase-1 sync wins do not regress.
18. As a guest, I want JACKPOT banner text to still appear with the salute, so that the win moment stays loud.
19. As a Round Owner after JACKPOT, I want Place result and Challenge flow unchanged, so that scoring rules stay familiar.
20. As an agent implementing this, I want glossary terms (Groom Salute, Room, Round, Round Owner) used in comments/tests, so that language stays shared.
21. As a guest who prefers less motion, I want the salute not to block gameplay if motion is reduced (shorten or skip particles), so that the table remains usable.
22. As a party guest, I want the stickers mixed in the burst (not only one icon type), so that football, Zvyrk, and Jesus all show up.
23. As a developer, I want no bundler and one HTML ship artifact, embedding or loading stickers in a way that still works on GitHub Pages.
24. As a guest, I want soft reset / score flow unaffected by the salute, so that celebration never awards points by itself.
25. As a watcher on a second phone, I want the salute triggered from shared JACKPOT timing (spin settle), so that phones celebrate the same landing without inventing a second Room.

## Implementation Decisions

- Respect existing ADRs (Night Progress wins, one default Room, open Round belongs to spinner). Do not redesign sync for this feature.
- Groom Salute fires only on JACKPOT / spin-settle celebration — not continuously during wheel rotation.
- Burst size/duration: short pack ≈ 12–20 sticker pieces, ~1s lifetime, then remove DOM nodes.
- Stickers: football (user asset), ginger-and-white side-view Zvyrk, emoji-style Jesus face with moderate head curls and a smooth (non-curly) beard — stored under the product’s groom-salute assets.
- All watching clients in the Room should show the salute when JACKPOT lands (drive off the same spin-settle / shared Round landing path already synced; do not add a separate salute RTDB document unless observation proves peers cannot see it otherwise).
- Extend the Game/`Malchishnik` observation API with a minimal salute signal for tests (e.g. active flag and/or recent fire counter/timestamp) without breaking existing query fields.
- Replace or upgrade the current colored-spark burst for JACKPOT so sticker pieces are the main confetti; avoid stacking two full bursts that obscure the result.
- Light control polish only: clearer enabled/disabled or labeling for spin, bandit, and score actions — no visual redesign of the whole page.
- Ship remains a single HTML page (+ static assets as needed for stickers on Pages). No bundler.
- Prefer `prefers-reduced-motion: reduce` to shorten or skip the particle salute while keeping JACKPOT banner.

## Testing Decisions

- Good tests assert external behavior through `window.Malchishnik` + Playwright (and stable controls), not private CSS keyframe names.
- Single seam: `Malchishnik` (extended with salute observation) + multi-client Playwright where peer visibility matters.
- Prior art: existing `qa-*.mjs`, `repro-score-wipe.mjs`, dual-spin / dual-award / mid-round-join scripts.
- Keep `npm run test:wipe` and `npm run test:qa` green.
- Add coverage that: (1) after a JACKPOT/spin settle, salute signal fires and sticker nodes appear briefly; (2) a second client in the same Room also observes the salute for that landing; (3) sync race suites still pass.
- Use isolated `?room=` ids for salute QA.

## Out of Scope

- Full UI redesign, new fonts/theme overhaul, or heavy “dashboard” layout changes.
- New Places/Challenges content, scoring formula changes, or sync redesign.
- Extra groom icons beyond the three agreed stickers (unless added later).
- Long ambient particle weather during the whole spin.
- Sound effects / haptics (unless already present and untouched).
- Multi-Room product changes to share links.

## Further Notes

- Assets live with the repo under the groom-salute asset folder; grilling locked sticker direction before this spec.
- Phase ordering: sync stability (done) → this UI/salute work.
- Tracker: local markdown under `.scratch/` (`docs/agents/issue-tracker.md`).
