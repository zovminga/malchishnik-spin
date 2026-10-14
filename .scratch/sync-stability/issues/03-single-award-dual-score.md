# 03: Single award (dual done/fail)

**What to build:** Points for an open Round apply once to the Round Owner. Any phone in the Room may press done/fail; a second press does not double the score. Proven with a two-client Playwright race on award.

**Blocked by:** 01 — Prefactor sync seams

**Status:** ready-for-agent

- [ ] Done/fail from any client awards the Round Owner (not the presser’s identity as owner)
- [ ] A second done/fail on the same Round does not apply points again
- [ ] After a successful award, the Round closes and Turn Player can advance as today
- [ ] Playwright multi-client test: two clients race done/fail — single award, correct Round Owner score
- [ ] Existing wipe and QA suites still pass
