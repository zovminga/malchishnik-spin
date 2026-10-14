# 01: Prefactor sync seams

**What to build:** Named in-file seams for RoomState, MergePolicy, and RoundSession stay clear inside the single ship page, using glossary language, without changing party-visible behavior. Existing wipe and QA checks stay green and `Malchishnik.query` keeps working as the test seam.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] RoomState, MergePolicy, and RoundSession are clearly named and separated as seams inside the single ship artifact (no bundler / multi-file runtime split)
- [ ] Glossary terms (Room, Round, Round Owner, Turn Player, Night Progress) are used consistently in comments around those seams
- [ ] `Malchishnik.query` (and helpers QA already uses) still expose the same observable game facts
- [ ] `npm run test:wipe` and `npm run test:qa` pass
