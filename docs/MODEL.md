# HEX — the model

This is the mathematics of the engine in `base44/shared/hex.ts` (state-6.4)
and of its observer in `base44/shared/observer.ts`. The reference
implementations are `validation/hexmodel.py` and `validation/rankcore.py`;
`tests/parity.mjs` checks that the code that runs matches them to rounding.

Every statement below is one of three kinds, and is marked: **definition**
(a choice), **result** (follows from the definitions, with the argument or a
citation), or **measured** (from the walk-forward tests in `validation/`).

## 1. Data and reads

A series is a sequence of real values $x_0, x_1, \dots$ with changes
$r_t = x_t - x_{t-1}$ (for strictly positive series, changes of $\ln x$) and
sizes $a_t = |r_t|$. Two binary outcomes are predicted one step ahead
(**definition**):

- **MOVE**: $y_{t+1} = \mathbf 1[r_{t+1} > 0]$.
- **RANGE**: $y_{t+1} = \mathbf 1[a_{t+1} > m_t]$, where $m_t$ is the median
  of $a_0, \dots, a_t$ (at least 20 values).

Everything computed at step $t$ uses the series up to $t$ only, and nothing
is updated with $y_{t+1}$ until it is known.

## 2. The observer's baseline

Let $y_1, y_2, \dots$ be the outcomes of one read. For a half-life $h$, with
$\gamma_h = 2^{-1/h}$, the discounted base rate is (**definition**)

$$b^{(h)}_t = \frac{1 + \sum_{u \le t} \gamma_h^{\,t-u} y_u}{2 + \sum_{u \le t} \gamma_h^{\,t-u}}, \qquad h \in \{32, 64, 128, 256, 512, 1024, \infty\}.$$

For MOVE one more predictor is added, the exchangeable rank rule: if $g_t$
earlier values are at or below $x_t$ among the $t+1$ values so far (counting
$x_t$), then $q^{\mathrm{rank}}_t = (t + 2 - g_t)/(t + 2)$.

**Result.** If $x_0, \dots, x_{t+1}$ are exchangeable and almost surely
distinct, $x_{t+1}$ is equally likely to fall in each of the $t + 2$ gaps
between the ordered earlier values, so
$P(x_{t+1} > x_t) = q^{\mathrm{rank}}_t$ exactly. Calling the likelier side
is then right with probability tending to $\mathbb E\max(U, 1 - U) = 3/4$ for
$U$ uniform. This is why a 75% hit rate on "next value higher" is not
evidence of structure (Vovk, Gammerman and Shafer, 2005).

The baseline is the Bayesian mixture of these $M$ predictors ($M = 7$ for
RANGE, $8$ for MOVE) from a uniform start (**definition**):

$$b_t = \sum_{m} w_{m,t}\, q_{m,t}, \qquad w_{m,t} \propto \prod_{u \le t} q_{m,u-1}(y_u).$$

**Result.** For every sequence of outcomes, the cumulative log loss of $b$
exceeds that of the best single predictor in the mixture by at most $\ln M$
(Vovk, 1990; Cesa-Bianchi and Lugosi, 2006, §9.1). The observer therefore
tracks whichever memory fits the series, at a cost bounded for all time.

The observer never issues a call. It supplies $b_t$.

## 3. The state

**Definition.** Each step has one line. For MOVE the line is
$\mathbf 1[r_t > 0]$; for RANGE it is $\mathbf 1[a_t > m_{t-1}]$. The state
$s_t \in \{0,1\}^6$ is the last six lines, oldest first: one of 64 patterns,
the vertices of the 6-cube $Q_6$. Write $d(s, j)$ for the Hamming distance
(the number of lines in which two patterns differ) and $\bar s$ for the
complement of $s$ (all six lines flipped), so $d(s, \bar s) = 6$.

## 4. The model and its estimator

**Definition (model).** Given the state, the next outcome is Bernoulli:

$$y_{t+1} \mid s_t = s \;\sim\; \mathrm{Bernoulli}(b_t + \delta_s).$$

$\delta_s$ is how far the state moves the probability from the baseline.

**Definition (estimator).** With a kernel $k$ on the cube, a discount
$\gamma$ and a prior strength $K$, keep for each state $j$

$$D_j = \sum_{u:\, s_u = j} \gamma^{\,t-u}\,(y_{u+1} - b_u), \qquad N_j = \sum_{u:\, s_u = j} \gamma^{\,t-u},$$

and predict

$$p_t = b_t + \frac{\sum_j k(s_t, j)\, D_j}{\sum_j |k(s_t, j)|\, N_j + K}, \qquad \text{clipped to } [0.01, 0.99].$$

**Result (what this estimator is).** Take $b$ constant and a non-negative
kernel. Put the prior $\theta_s \sim \mathrm{Beta}(Kb,\, K(1-b))$ on the
probability in state $s$, and let an outcome seen in state $j$ at age
$t - u$ enter the likelihood for state $s$ with weight
$\omega_u = \gamma^{\,t-u} k(s, j)$ (a local likelihood: Tibshirani and
Hastie, 1987; with discounting as a power prior: Ibrahim and Chen, 2000; West
and Harrison, 1997). The posterior is
$\mathrm{Beta}(Kb + \sum \omega_u y_{u+1},\; K(1-b) + \sum \omega_u (1 - y_{u+1}))$
and its mean is

$$\frac{Kb + \sum_u \omega_u y_{u+1}}{K + \sum_u \omega_u} = b + \frac{\sum_u \omega_u (y_{u+1} - b)}{K + \sum_u \omega_u},$$

which is the estimator above. So $p_t$ is a Beta-Bernoulli posterior mean
under a kernel-weighted, discounted likelihood, with $K$ the number of
pseudo-observations behind the prior belief that the state changes nothing.
When $b$ varies with time the same expression is used with each outcome
measured against the baseline in force when it was predicted; that step is a
definition, not a derivation.

A negative kernel weight has a plain meaning: since
$-(y - b) = (1 - y) - (1 - b)$, an outcome seen in state $j$ with
$k(s, j) < 0$ counts as evidence for the opposite outcome in state $s$.

## 5. The kernel

**Definition.** Two kernels are used, each with a parameter
$\rho \in [0, 1)$:

$$k^{\mathrm{plain}}_\rho(s, j) = \rho^{\,d(s,j)}, \qquad k^{\mathrm{odd}}_\rho(s, j) = \rho^{\,d(s,j)} - \rho^{\,6 - d(s,j)},$$

with $0^0 = 1$, so $\rho = 0$ gives no sharing (plain) or sharing with the
mirror state only (odd).

**Result.** $k^{\mathrm{plain}}_\rho$ is the diffusion kernel of the cube.
The heat kernel $e^{-\beta L}$ of the graph Laplacian $L$ of $Q_6$ factorises
over the six coordinates and equals a constant times $(\tanh\beta)^{d(s,j)}$,
so $\rho = \tanh\beta$ (Kondor and Lafferty, 2002). It is positive definite. In
words: evidence is allowed to diffuse along the edges of the cube for a time
$\beta$.

**Result.** $k^{\mathrm{odd}}_\rho(s, j) = k^{\mathrm{plain}}_\rho(s, j) - k^{\mathrm{plain}}_\rho(s, \bar\jmath)$
is, up to the factor $\tfrac12$, the same kernel restricted to odd functions
on the cube, those with $\delta_{\bar s} = -\delta_s$. It encodes the
assumption that the mirror pattern pulls the opposite way, and it remains
positive semi-definite because it is a projection of a positive definite
kernel onto a subspace.

The absolute value in the denominator of the estimator, and dropping the
factor $\tfrac12$, are normalisation **definitions**.

## 6. No hand-set numbers: the mixture

**Definition.** Every quantity that was a fixed number in 6.2 is a family:

| Quantity | Family | In 6.2 |
|---|---|---|
| Sharing between states, $\rho$ | $0, \tfrac18, \tfrac14, \tfrac12$ | weights $1/d^2$ to distance 2, four strengths |
| Symmetry | plain, odd | mirror for direction only |
| Prior strength, $K$ | 16, 64, 256 | 100 |
| Half-life of evidence | 64, 256, 1024, none | factor 0.999 |

That is $4 \times 2 \times 3 \times 4 = 96$ candidates $p^{(e)}$. The stated
probability is their Bayesian mixture from a uniform start:

$$p_t = \sum_{e} w_{e,t}\, p^{(e)}_t, \qquad w_{e,t} \propto \prod_{u \le t} p^{(e)}_{u-1}(y_u).$$

**Result.** For every sequence of outcomes, the cumulative log loss of the
mixture exceeds that of the best single candidate by at most $\ln 96 \approx 4.56$
nats in total (same theorem as in §2). Per step this vanishes as $1/T$. The
engine therefore does as well, in the long run and on any series, as the best
fixed setting of $\rho$, symmetry, $K$ and half-life chosen in hindsight.

Together with §2: the total log loss of HEX is within $\ln 96$ of its best
candidate, each of which is built on a baseline that is itself within
$\ln M$ of the best single memory.

## 7. Calibration

**Definition.** The stated probability is passed through one monotone map
per read, fitted by isotonic regression (pool adjacent violators; Ayer et
al., 1955) on calls whose outcomes are already known, pooled across every
tracked series, and refitted nightly from the ledger.

**Measured.** Pooled across series this map lowers log loss on market series
(by 1.3 thousandths of a nat per call, interval clear of zero) and narrows
the overstatement on the strongest tenth of calls. A map fitted on one series
alone does not lower log loss.

## 8. What remains a choice

These are definitions without a derivation. Each is a small set of
alternatives or a convention, and each is stated so it can be challenged:

1. Six lines, hence 64 states.
2. The line for RANGE compares with the median of all earlier changes.
3. The grids for $\rho$, $K$ and the half-lives (dyadic or near-dyadic).
4. The clip to $[0.01, 0.99]$, which bounds every loss by $\ln 100$.
5. The first step predicted (26) and the 20 values needed for a median.
6. Exponential form of the discount.

## 9. What is not claimed

- No theorem says the outcome really is Bernoulli with probability
  $b + \delta_s$. The model is a working description; the guarantees in §2
  and §6 hold whether or not it is true.
- The estimator is a posterior mean under a local, discounted likelihood. It
  is not the posterior of a full joint model over all 64 states.
- No guarantee of calibration is proved; calibration is measured (§7).
- Only the binary structure of the six lines is used: the cube, Hamming
  distance and the complement. Richer castings of the lines were tested as
  hypotheses and added nothing (`validation/core7.py`).

## 10. Measured results

Walk-forward, every call made before its outcome; markets are 17 series over
2016–2026 (46,954 calls per read). Gains are thousandths of a nat per call
with a 95% interval (`validation/core6.py`, `prereg_core6.md`).

| Read, domain | 6.2 right | 6.4 right | Baseline rule right | 6.4 over its baseline |
|---|---|---|---|---|
| RANGE, markets | 58.8% | 59.9% | 59.7% | −0.1 [−0.4, 0.2] |
| MOVE, markets | 51.5% | 50.8% | 50.9% | +0.4 [0.2, 0.7] |
| MOVE, weather | 56.4% | 56.2% | 51.2% | +11.1 [8.8, 13.3] |
| RANGE, weather | 55.6% | 55.9% | 55.7% | +0.8 [0.2, 1.4] |
| MOVE, racing | 64.9% | 75.0% | 74.9% | +2.2 [−0.1, 5.2] |
| RANGE, racing | 50.8% | 50.6% | 49.7% | +1.2 [−0.5, 4.1] |

Three things follow, and they are stated plainly because they bear on any
claim made for the engine:

1. **6.4 matches the hand-tuned 6.3 everywhere** (largest difference 0.7,
   in 6.4's favour), with no pre-trained tables and no fixed numbers, and it
   starts faster on a new series.
2. **On market move size the 64 states add nothing measurable beyond the
   baseline.** The gain over 6.2 there (58.8% to 59.9%) comes from the
   observer's baseline following recent behaviour, not from the patterns.
3. **The states carry real information on weather direction** (+11.1) and a
   little elsewhere. Market direction stays at chance.

## 11. The spectral form: why the pieces fit together

The estimator, the kernel, the discount and the mixture are one construction
seen from different sides. This section states it and reports what it shows.

**Walsh characters.** For a set $A$ of lines let
$\chi_A(s) = (-1)^{\#\{i \in A:\, s_i = 1\}}$. The 64 characters are an
orthogonal basis for functions on the cube, so any state effect is
$\delta_s = \sum_A c_A \chi_A(s)$. The size $|A|$ is the number of lines the
term depends on: $|A| = 1$ is "this line alone", $|A| = 2$ is "these two
lines together", up to $|A| = 6$, the whole pattern at once.

**Result (the kernel is a price on complexity).** The diffusion kernel is
diagonal in this basis:

$$\sum_j \rho^{\,d(s,j)}\, \chi_A(j) = (1+\rho)^6\, \lambda^{|A|}\, \chi_A(s), \qquad \lambda = \frac{1-\rho}{1+\rho} = e^{-2\beta}.$$

So sharing evidence between neighbouring states is the same thing as a prior
in which every additional line a pattern depends on costs one more factor of
$\lambda$. The odd kernel keeps exactly the terms with $|A|$ odd, the even
kernel those with $|A|$ even. (Checked numerically to rounding,
`validation/core8.py`.)

**Result (the ladder).** The walk that flips one line at a time has
eigenvalues $1 - 2k/6$ on the terms with $|A| = k$: seven evenly spaced
levels. The weight $\lambda^k = e^{-2\beta k}$ is a Boltzmann factor on that
ladder with $\beta$ as inverse temperature. This is the exact sense in which
the six-line system resembles a harmonic oscillator; it is a property of six
binary lines and involves no quantum mechanics.

**Result (space and time are the same operation).** The discount
$\gamma^{\,t-u} = e^{-(t-u)\ln 2/h}$ is the same exponential smoothing applied
along time that $\rho^d$ applies along the edges of the cube. Evidence
spreads between similar patterns at rate $\beta$ and fades at rate $1/h$. The
mixture over $(\rho, h, K)$ is Bayesian selection of both scales. The
observer's baseline is the $|A| = 0$ term, the part of the outcome that does
not depend on the pattern, tracked at dyadic memories.

**The exact posterior.** With independent priors
$c_A \sim N(0, \tau^2 \lambda^{|A|})$ and $y - b = \delta_s + \varepsilon$,
$\operatorname{Var}\varepsilon = b(1 - b)$, the posterior over all 64
coefficients is a Kalman update, with forgetting as a relaxation of the
coefficients toward zero. This is the full joint model of which §4 is the
state-by-state approximation.

**Measured** (`validation/core8.py`, `prereg_core8.md`). The exact posterior
ties state-6.4 on every read (largest difference 1.2 thousandths of a nat),
so the approximation in §4 loses nothing and the simpler form ships. It also
shows where the information is. Share of the fitted effect by how many lines
a term involves:

| Read, domain | One line | Two lines | Three or more |
|---|---|---|---|
| MOVE, weather | 98% | 1% | under 1% |
| RANGE, weather | 100% | 0% | 0% |
| MOVE, markets | 95% | 1% | 2% |
| RANGE, markets | 91% | 4% | 1% |

(The remainder is the constant term.) Candidates that treat each of the 64
patterns as its own unrelated case received 0–3% of the weight on these
reads. **The six lines carry their information one at a time. The pattern as
a whole adds almost nothing beyond the sum of its lines.**

## References

- Ayer, M., Brunk, H. D., Ewing, G. M., Reid, W. T. and Silverman, E. (1955). An empirical distribution function for sampling with incomplete information. *Annals of Mathematical Statistics*, 26, 641–647.
- Cesa-Bianchi, N. and Lugosi, G. (2006). *Prediction, Learning, and Games*. Cambridge University Press.
- Dawid, A. P. (1984). Statistical theory: the prequential approach. *Journal of the Royal Statistical Society A*, 147, 278–292.
- Ibrahim, J. G. and Chen, M.-H. (2000). Power prior distributions for regression models. *Statistical Science*, 15, 46–60.
- Kac, M. (1947). Random walk and the theory of Brownian motion. *American Mathematical Monthly*, 54, 369–391.
- Kondor, R. I. and Lafferty, J. (2002). Diffusion kernels on graphs and other discrete structures. *Proceedings of the 19th International Conference on Machine Learning*, 315–322.
- Tibshirani, R. and Hastie, T. (1987). Local likelihood estimation. *Journal of the American Statistical Association*, 82, 559–567.
- Vovk, V. (1990). Aggregating strategies. *Proceedings of the 3rd Workshop on Computational Learning Theory*, 371–383.
- Vovk, V., Gammerman, A. and Shafer, G. (2005). *Algorithmic Learning in a Random World*. Springer.
- West, M. and Harrison, J. (1997). *Bayesian Forecasting and Dynamic Models*, 2nd edition. Springer.
