# Sixth experiment: HEX as an explicit model with no hand-set numbers. Predictions written before the run

Written 4 October 2026, before `core6.py` was first executed.

Model ("state-6.4"). The state s is the six-line pattern (64 states, both
reads). The outcome is Bernoulli with probability b + delta_s, where b is the
observer's baseline. delta_s is estimated by a local-likelihood Beta-Bernoulli
posterior mean on the 6-cube:

    p = b + sum_j k(s,j) D_j / ( sum_j |k(s,j)| N_j + K )

    D_j = discounted sum of (y - b) seen in state j, N_j = discounted count
    k   = diffusion kernel on the cube, rho^d (d = lines that differ), or its
          odd part rho^d - rho^(6-d) (evidence in the mirror state counts as
          opposite evidence)

Every number that was fixed in 6.2 becomes a family, mixed by plain Bayesian
likelihood weights from a uniform start (no forgetting of the weights):
    rho        in {0, 1/8, 1/4, 1/2}      (was: weights 1/d^2 to distance 2, four field strengths)
    symmetry   in {plain, odd}            (was: mirror for direction only)
    K          in {16, 64, 256}           (was: 100)
    half-life  in {64, 256, 1024, none}   (was: decay 0.999)
96 candidates. No pre-trained tables. No consensus bit.

1. Market RANGE: 6.4 is within 1 thousandth of a nat of 6.3 and at least
   59.8% of calls right.
2. On market RANGE the weight goes to rho > 0 and to the plain kernel. On
   racing MOVE the odd kernel carries the weight.
3. Dropping the consensus bit and the tables costs under 1 on every domain
   and read.
4. Cold start (first 250 steps of held-out market series, RANGE): 6.4 is
   within 2 of 6.3.
