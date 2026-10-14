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
The player who spun this Round and who alone receives its points.
_Avoid_: Active player (for this meaning), spinner (unless speaking casually)

**Turn Player**:
Whose turn it is to spin when there is no open Round.
_Avoid_: Round Owner, activePlayer (code name)

**Night Progress**:
How far a Room has gotten — history, players, and scores. When two versions of a Room conflict, the one with more Night Progress wins.
_Avoid_: Richness (code name), freshness, latest write
