# 02: One open Round (dual spin)

**What to build:** A Room has at most one open Round. The Round Owner who spun keeps that Round until it is scored; another phone’s spin does not overwrite it. Proven with a two-client Playwright race on spin.

**Blocked by:** 01 — Prefactor sync seams

**Status:** ready-for-agent

- [ ] While a Round is open, a second client cannot replace it with a new spin
- [ ] Round Owner stays the spinner who opened the Round until award
- [ ] Spin controls on non-owning / late clients do not create a second open Round
- [ ] Playwright multi-client test: two clients race spin — only one open Round / Round Owner wins
- [ ] Existing wipe and QA suites still pass
