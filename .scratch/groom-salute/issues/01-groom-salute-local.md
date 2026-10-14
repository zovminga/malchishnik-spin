# 01: Groom Salute on JACKPOT (local)

**What to build:** When the wheel hits JACKPOT, a short Groom Salute bursts the three groom stickers (football, ginger-and-white Zvyrk, Jesus face) like confetti (~12–20 pieces, about one second), with the JACKPOT banner still showing. `Malchishnik` exposes a salute signal for tests. Proven on one client with Playwright; existing wipe/QA stay green.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Groom Salute fires only on JACKPOT / spin-settle, not during the whole spin
- [x] Burst mixes football, Zvyrk, and Jesus stickers; ~12–20 pieces; ~1s then cleaned up
- [x] JACKPOT banner still appears; sticker burst is the main confetti (no messy double full burst)
- [x] `Malchishnik.query` (or related helper) exposes salute active/recent signal without breaking existing fields
- [x] Playwright single-client check asserts salute signal + sticker presence on JACKPOT
- [x] `npm run test:wipe` and `npm run test:qa` pass
