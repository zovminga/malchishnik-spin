# 02: Game Restart + reset UI contract

**What to build:** Game Restart does a Score Clear and also removes every Player for everyone in the Room (including after refresh), while Places and Challenges stay. Both Score Clear and Game Restart are compact controls near the bottom with distinct confirms; cancel leaves the Room unchanged. The old «Обнулить игру» and «сброс кэша» controls are gone so party-wide clears only go through these two actions.

**Blocked by:** 01: Score Clear sticks across devices via Room Generation

**Status:** resolved

- [x] Game Restart clears scores, night log, open Round, and the Player list; bumps Room Generation; keeps Places/Challenges
- [x] Peer B sees an empty Player list live after Game Restart on A; refresh on A and B still empty of Players
- [x] Places/Challenges unchanged on every phone after Game Restart
- [x] Score Clear and Game Restart are smaller controls near the bottom; copy-link stays the primary top action
- [x] Distinct confirm dialogs for Score Clear vs Game Restart; cancel is a no-op on both
- [x] «Обнулить игру» and «сброс кэша» removed from the product
- [x] After Game Restart with no Players, spin waits until someone is added; after Score Clear, Turn Player returns to the first remaining Player
- [x] `npm run test:wipe` and `npm run test:qa` pass

## Answer

Game Restart (`#gameRestartBtn` / «Перезапустить игру») does Score Clear plus empties Players, bumps Room Generation, keeps Places/Challenges. Both reset controls sit compact in the footer; copy-link stays the top primary. Distinct confirms; cancel no-op. Removed `hardReset` / «сброс кэша». `scripts/qa-game-restart.mjs` (multi-device + refresh + places + cancel) wired into `test:qa`. Build 24. `test:wipe` + `test:qa` green against local BASE.
