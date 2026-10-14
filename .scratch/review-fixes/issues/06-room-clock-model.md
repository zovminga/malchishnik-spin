# 06: Merge decisions depend on phone clocks

**Status:** needs-triage

**Type:** note (not scheduled)

MergePolicy compares `updatedAt`, which each phone fills from its own `Date.now()`. A phone whose clock runs ahead makes other phones' writes that do not add Night Progress (open Round, Challenge pick, Turn Player, Place edits) look older; `shouldWrite` silently rejects them for as long as the clock gap. Review probe: with a phone 120 s ahead, a correct-clock phone opened a Round the other phone never saw, so two Rounds could be opened.

Candidate direction (not decided): Firebase `ServerValue.TIMESTAMP` / server time offset (`.info/serverTimeOffset`) instead of raw phone clocks. Out of scope for review-fixes P0–P4; needs its own design and ADR because it changes the MergePolicy contract.
