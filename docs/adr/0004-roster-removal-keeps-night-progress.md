# Roster removal sticks for every phone

Status: revised (originally «Roster removal keeps Night Progress sync»)

Removing a Player is an intentional action and must stick on every phone. Each Player carries a stable id; removing one records that id on the Room in `removedPlayers`. Before any Night Progress comparison — on write and on receiving the Room — every phone drops the listed Players from both copies, so a fuller copy that still has the Player cannot bring them back, and a write that is otherwise rejected still carries the removal to the Room. Removal does not bump Room Generation and does not touch other Players' scores or the night log; Night Progress (ADR-0001) still decides everything else. Re-adding the same name creates a new Player with a new id. If the Round Owner of an open Round is removed on another phone, that Round closes without points (as Round Reset does, ADR-0006).

Previously: removal stayed under plain Night Progress and a fuller phone could put the Player back. In practice that happened on almost every removal — the removing phone's thinner write was rejected, and the next action on any other phone restored the Player.

Rejected: bumping Room Generation for a removal (would discard Rounds played on other phones at the same moment) and matching removed Players by name (breaks re-adding the same name; duplicate names are allowed).
