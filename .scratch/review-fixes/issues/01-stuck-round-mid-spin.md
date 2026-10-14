# 01: Reload mid-spin must not leave the Room stuck

**What to build:** A reload or closed tab on the Round Owner's phone during the wheel animation no longer leaves an open Round without a Place. The Place is written when the spin starts; any phone settles a stalled Round on that Place; an open Round without a Place gets Round Reset instead of Score Clear. See ADR-0006.

**Status:** done

- [x] Place is on the wire from spin start; peers still see it only after the wheel stops
- [x] Spinner reloads ~1.5s into the spin → Round recovers with its Place on both phones and can be scored
- [x] Spinner closes the tab mid-spin → peer recovers the Round with its Place
- [x] Open Round without a Place (older build) → Round Reset appears after the stall, closes the Round for every phone, keeps scores, night log, Turn Player and Room Generation, survives reload
- [x] Playwright: `scripts/qa-reload-mid-spin.mjs`, added to `npm run test:qa`
- [x] `qa-stuck-open-round` and the rest of `test:qa` stay green
