# 03: Removing a Player sticks for every phone

**What to build:** Removing a Player is intentional and must win on every phone without bumping Room Generation and without touching other Players' scores or the night log. Players get a stable id; removals are recorded on the Room; MergePolicy drops removed Players from both copies before comparing Night Progress. See revised ADR-0004.

**Blocked by:** 02 — Offline phone is visible and does not change the Room

**Status:** done

- [x] Player id (`legacy-<index>-<name>` for Rooms written by older builds); `removedPlayers` on the Room
- [x] Peer sees the removal; peer chip tap, peer Round and reload do not bring the Player back
- [x] Removal while a peer's wheel is spinning sticks and the peer's Round is kept
- [x] Room Generation unchanged; other scores and night log unchanged
- [x] Re-adding the same name creates a new Player at 0
- [x] Legacy Room without Player ids: removal sticks
- [x] Playwright: `scripts/qa-remove-player-peers.mjs`, added to `npm run test:qa`; single-phone `qa-remove-player` still green
- [x] Rest of `test:qa` and `test:wipe` stay green (P0 reload mid-spin, P1 offline, Round Reset)
