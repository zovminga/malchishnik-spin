# Offline phone does not change the Room

A phone that lost its connection used to keep playing locally; Firebase queued its whole-state write and, on reconnect, Night Progress / Room Generation decided which copy survived — so Rounds played on the other side were silently lost (an offline Score Clear even wiped a peer's later Round). Now each phone watches its connection (Firebase `.info/connected` plus the browser online flag, with a short grace against blips), shows «нет связи — очки и ходы не уходят», and blocks every Room change — spin, Challenge pick, done/fail, Round Reset, Score Clear, Game Restart, roster and Place/Challenge edits — until it is back. Writes already in flight when the connection drops still go through MergePolicy as before; a Round opened before the drop already has its Place on the wire (ADR-0006), so a peer can settle and score it.

On reconnect, a phone that still shows an open Round but receives a Room with more Night Progress adopts the Room instead of defending that Round (ADR-0003): the Room moved past it, and a defend push would be rejected anyway, leaving the phone stuck. The spinning phone keeps its old behaviour during the wheel animation.

Rejected: queue offline actions and merge on reconnect (whole-state writes cannot merge two sides of a split), and per-field writes / a server-side log (too large a change for the single-file ship).
