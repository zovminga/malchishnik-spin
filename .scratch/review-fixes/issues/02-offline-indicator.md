# 02: Offline phone is visible and does not change the Room

**What to build:** A phone without a connection shows «нет связи — очки и ходы не уходят» and cannot change the Room until it is back, so no Round is silently lost on reconnect. A phone that missed an award while away adopts the Room after reconnect instead of staying on a stale open Round. See ADR-0007.

**Blocked by:** 01 — Reload mid-spin must not leave the Room stuck

**Status:** done

- [x] `.info/connected` + browser online flag, short grace against blips; `Malchishnik.query().roomOffline`
- [x] Bar «● Нет связи — очки и ходы не уходят»; spin shows «НЕТ СВЯЗИ»; Room-changing controls dimmed and guarded
- [x] Offline spin / add Player / Score Clear do nothing; peer Night Progress survives the reconnect
- [x] Offline Round Owner cannot award; a peer scores; one award on both phones after reconnect
- [x] Phone that missed the award of an open Round catches up after reconnect (was stuck forever)
- [x] Playwright: `scripts/qa-offline.mjs`, added to `npm run test:qa`
- [x] Rest of `test:qa` and `test:wipe` stay green; Round Reset for a Round without a Place unchanged
