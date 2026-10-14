# Malchishnik Spin

Shared casino roulette for a bachelor-party night: one wheel of places, challenges, and a scoreboard everyone sees together.

## Language

**Room**:
The shared party game everyone plays in. Friends join the default room through the plain share link; other room ids are for isolated testing, not for splitting a friend group.
_Avoid_: Session, lobby, lobby code

**Place**:
A stop on the night that the wheel can land on.
_Avoid_: Destination, segment, venue tile

**Challenge**:
A task attached to a Place that may be drawn after the wheel lands.
_Avoid_: Quest, mini-game, assignment

**Round**:
The open stretch after a spin lands until points for that spin are awarded.
_Avoid_: Turn (for this meaning), spin result window

**Round Owner**:
The player who spun this Round and who alone receives its points. Not the same idea as Turn Player.
_Avoid_: Active player (for this meaning), «чей ход», spinner (unless speaking casually)

**Turn Player**:
Whose turn it is to spin when there is no open Round. Not the same idea as Round Owner.
_Avoid_: Round Owner, «кому очки», activePlayer (code name)

**Night Progress**:
How “full” a Room already is: entries in the night log, players on the list, and total scores. A fuller Room beats a emptier one when phones disagree — so a fresh phone with almost nothing does not wipe the party.
_Avoid_: Richness (code name), freshness, latest write, «кто последний сохранил»

**Groom Salute**:
A short burst of groom-themed mini pictures (football, ginger-and-white cat Zvyrk, Jesus face) that flies like confetti when the wheel hits JACKPOT — not during the whole spin. Everyone currently in the Room who is watching sees it.
_Avoid_: Confetti (unless speaking casually), FX sparks (the old colored dots)
