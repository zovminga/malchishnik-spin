# 02: Peer Groom Salute

**What to build:** When JACKPOT lands in a Room, every phone currently watching sees the Groom Salute for that landing — not only the spinner’s device. Proven with a two-client Playwright check; sync race suites stay green.

**Blocked by:** 01 — Groom Salute on JACKPOT (local)

**Status:** ready-for-agent

- [x] Second client in the same Room observes the Groom Salute for the shared JACKPOT landing
- [x] No separate salute document required unless peers cannot see it via the existing spin-settle / Round path
- [x] Night Progress, Round Owner, and open-Round rules unchanged
- [x] Playwright multi-client check covers peer salute visibility
- [x] Existing wipe and race QA (dual-spin, dual-award, mid-round join) still pass
