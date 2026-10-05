# Tenth experiment: two ideas from quantum game theory. Predictions written before the run

Written 4 October 2026, before `core10.py` was first executed.
Source: Flitney and Abbott, "An introduction to quantum game theory" (2002).

HEX plays against a series, which shares no state with it, on ordinary
hardware, so nothing here is a quantum advantage. Two constructions in the
paper are nonetheless definite mathematics on six two-valued lines.

**1. The entangling gate as a dial.** The gate J = exp(i (gamma/2) X^(x6)) of
the Eisert protocol couples each six-line pattern to its mirror (all six lines
flipped) and to nothing else, with gamma running from no coupling to full.
HEX's kernel has two settings of that coupling: none (plain) and -1 (odd:
evidence in the mirror state counts as opposite evidence). The dial is

    k_c(s, j) = rho^d + c * rho^(6 - d),   c in {-1, -1/2, 0, +1/2, +1},

where c = +1 (mirror counts as the same evidence) has never been tried.
In the Walsh basis c = -1 keeps the odd orders, c = +1 the even orders.

**2. Parrondo coupling.** Two games that lose alone can win when the choice
of game depends on the other's history. HEX's two reads never see each other.
Coupled version: beside the candidates that read a read's own six lines, add
candidates that read the other read's six lines (direction called from the
size pattern, size called from the direction pattern), and a third set that
reads three lines of each. One mixture weighs them all.

Scored by closeness, 1 - (p - y)^2, in thousandths per call, against
state-6.4 on the same calls, with the block bootstrap used before.
Domains and reads as in the sixth experiment.

Predictions

1. Mirror dial: no gain. Within 0.5 on every domain and read. Earlier results
   put 91 to 100% of the fitted effect on single lines, which are odd; a
   positive c removes exactly those, so the mixture should give c > 0 less
   than its 40% share of the candidates everywhere.
2. Coupling, direction from the size pattern: no gain on any domain (within
   0.3). Direction stays at chance on markets.
3. Coupling, size from the direction pattern: a small gain on market move
   size (falls are followed by larger moves), under 1; nothing elsewhere.
4. Neither is added to the engine unless it gains at least 1 on some domain
   with an interval clear of zero and loses nowhere.
