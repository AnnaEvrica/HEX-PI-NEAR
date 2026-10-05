# Eighth experiment: the exact spectral form of HEX. Predictions written before the run

Written 4 October 2026, before `core8.py` was first executed.

Identity to be checked numerically first: the cube's diffusion kernel rho^d is
diagonal in the Walsh basis, with the component that involves k lines scaled
by lambda^k, lambda = (1 - rho)/(1 + rho) = exp(-2 beta). So state-6.4's
sharing is a prior in which every extra line a pattern depends on costs the
same factor.

Model ("spectral"): delta_s = sum_A c_A chi_A(s) over the 64 Walsh characters,
with independent priors c_A ~ N(0, tau^2 lambda^|A|), observation
y - b = delta_s + noise of variance b(1-b). The exact posterior is a Kalman
update in 64 dimensions. Families, mixed by Bayesian weights: lambda in
{1/64, 1/16, 1/4, 1}, parity in {all, odd, even}, tau^2 in {2^-13, 2^-10,
2^-7}, forgetting half-life in {256, none}. 72 candidates. This is the full
joint posterior that state-6.4's estimator approximates one state at a time.

1. The identity holds to rounding.
2. Weather MOVE: spectral beats 6.4 with an interval clear of zero.
3. Elsewhere spectral is within 1 of 6.4.
4. The fitted effect is concentrated in low orders: at least 80% of its
   variance in orders 1 and 2 on weather MOVE.
5. Parity: MOVE puts its weight on odd, RANGE on all or even.
