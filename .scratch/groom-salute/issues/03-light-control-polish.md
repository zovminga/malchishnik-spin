# 03: Light control polish

**What to build:** Spin, bandit, and score controls are a bit clearer to use (when you can spin, whether the bandit is still rolling, done/fail when a Round is open) without a full UI redesign. Groom Salute must not make those controls harder. Full `test:qa` stays green.

**Blocked by:** 01 — Groom Salute on JACKPOT (local)

**Status:** ready-for-agent

- [ ] Turn Player can tell when spin is available
- [ ] Bandit rolling vs Challenge picked is clearer
- [ ] Done/fail is easy to find when a Round is open
- [ ] Salute does not block or obscure those controls after it finishes
- [ ] `prefers-reduced-motion` shortens or skips particle salute without blocking play
- [ ] Full wipe + `test:qa` pass
