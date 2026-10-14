# 04: Mid-round join keeps the night

**What to build:** A third phone joining during an open Round sees the same Night Progress and Round Owner; the join does not wipe scores/history or steal the Round. Proven with a Playwright mid-round join check.

**Blocked by:** 01 — Prefactor sync seams; 02 — One open Round (dual spin)

**Status:** ready-for-agent

- [ ] Joining mid-Round does not drop Night Progress (scores / night log / players)
- [ ] Open Round and Round Owner remain visible/consistent after the join
- [ ] Empty local state on the joiner does not overwrite the fuller Room
- [ ] Playwright test: third client joins during open Round — Night Progress and Round Owner preserved
- [ ] Existing wipe and QA suites still pass; race scripts from 02/03 remain green
