# 04: Editor survives peer writes; Room strings cannot inject HTML

**What to build:** Editing Places / Challenges while other phones play must not lose half-typed text, caret or focus, and typing must stay on its Place when a peer adds a Place on top. Colours and other strings from the Room are validated and escaped before they reach HTML. No new editor features (Place tagline / colour editing stays out of scope).

**Blocked by:** 03 — Removing a Player sticks for every phone

**Status:** done

- [x] Remote render keeps the focused Place block in place (value, caret, focus, phone keyboard); other blocks keep half-typed Challenges by Place id
- [x] Kept block catches up after blur
- [x] Editor actions find the Place by id, not by list position; Challenge delete matches the shown text
- [x] `esc` covers `<>&"'`; colours from the Room accepted only as `#rgb` / `#rrggbb(aa)`; night-log entries normalised; every colour sink escaped
- [x] Playwright: `scripts/qa-editor-sync.mjs`, added to `npm run test:qa`
- [x] Rest of `test:qa` and `test:wipe` stay green (P0–P2)
