# 03: Single award (dual done/fail)

**What to build:** Points for an open Round apply once to the Round Owner. Any phone in the Room may press done/fail; a second press does not double the score. Proven with a two-client Playwright race on award.

**Blocked by:** 01 — Prefactor sync seams

**Status:** done

- [x] Done/fail from any client awards the Round Owner (not the presser’s identity as owner)
- [x] A second done/fail on the same Round does not apply points again
- [x] After a successful award, the Round closes and Turn Player can advance as today
- [x] Playwright multi-client test: two clients race done/fail — single award, correct Round Owner score
- [x] Existing wipe and QA suites still pass
