# Ninth experiment: the quantum walk on the six lines. Predictions written before the run

Written 4 October 2026, before `core9.py` was first executed.

Six two-valued lines are six qubits. With H = sum_i (1 - X_i), where X_i flips
line i, the engine's diffusion kernel is the thermal operator exp(-beta H):
imaginary-time evolution. The real-time evolution exp(-i H t) is the quantum
walk on the cube. Its transition probability from pattern s to pattern j is

    q_t(s, j) = (cos^2 t)^(6 - d) (sin^2 t)^d ,   d = lines that differ.

Unlike diffusion it is not monotone in distance: at t = pi/4 every pattern is
equally likely, and at t = pi/2 the walk sits on the mirror pattern with
certainty (perfect state transfer). In the Walsh basis its eigenvalue on a
term involving k lines is cos(2t)^k, which is negative for odd k when
t > pi/4, something no diffusion can produce.

Identities to check numerically: the formula for q_t; perfect transfer to the
complement at pi/2; eigenvalues cos(2t)^k.

Test: add quantum-walk kernels at t in {pi/8, pi/4, 3pi/8, pi/2} (and the
signed real part of the amplitude) to state-6.4's candidates on the MOVE read,
and let the mixture weigh them against the diffusion kernels.

1. The three identities hold to rounding.
2. The mixture gives the quantum-walk kernels little weight, and the combined
   model is within 1 thousandth of a nat of state-6.4 on every domain: the
   information is carried by single lines, which a diffusion prior already
   expresses and which the far-reaching quantum kernels dilute.
