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
The open stretch from a spin until points for that spin are awarded or the Round is reset. Its Place is chosen when the wheel starts turning and shown to everyone when the wheel stops.
_Avoid_: Turn (for this meaning), spin result window

**Round Reset**:
An action that closes only an open Round nobody can finish (it has no Place), with no points. Turn Player, Night Progress and Room Generation stay as they were. Offered only for such a stuck Round.
_Avoid_: Score Clear (for this meaning), «сбросить игру», abort

**Round Owner**:
The player who spun this Round and who alone receives its points. Not the same idea as Turn Player.
_Avoid_: Active player (for this meaning), «чей ход», spinner (unless speaking casually)

**Turn Player**:
Whose turn it is to spin when there is no open Round. Not the same idea as Round Owner.
_Avoid_: Round Owner, «кому очки», activePlayer (code name)

**Player**:
Someone on the Room roster with a display name and a running score. Adding and removing Players changes who can take a turn; night-log lines that already name them stay as history.
_Avoid_: Participant, member, guest (for the roster seat), участник (UI may say «игроки»)

**Night Progress**:
How “full” a Room already is: entries in the night log, Players on the list, and total scores. When Room Generation matches, a fuller Room beats a emptier one — so a fresh phone with almost nothing does not wipe the party. A removed Player stays removed on every phone: Night Progress is compared only after removed Players are dropped.
_Avoid_: Richness (code name), freshness, latest write, «кто последний сохранил»

**Room Generation**:
A monotonic version on the Room that rises only on Score Clear or Game Restart. A higher Room Generation beats a lower one even when Night Progress is thinner; equal Room Generation falls back to Night Progress.
_Avoid_: Reset token, epoch, wipe counter, sync version (unless speaking about code)

**Groom Salute**:
A short burst of groom-themed mini pictures (football, ginger-and-white cat Zvyrk, Jesus face) that flies like confetti when the wheel hits JACKPOT — not during the whole spin. Everyone currently in the Room who is watching sees it.
_Avoid_: Confetti (unless speaking casually), FX sparks (the old colored dots)

**Score Clear**:
An intentional Room action that zeroes every Player's score, clears the night log, and aborts any open Round, while keeping the Player list and Places/Challenges. Unlike a thinner accidental join, a Score Clear must stick for everyone in the Room.
_Avoid_: Soft reset, «Обнулить игру» (old single button), wipe (for accidental empty-phone joins)

**Game Restart**:
An intentional Room action that does a Score Clear and also removes every Player from the Room, while keeping Places/Challenges.
_Avoid_: Hard reset (removed cache button), full wipe, «перезапуск» without saying Players leave
