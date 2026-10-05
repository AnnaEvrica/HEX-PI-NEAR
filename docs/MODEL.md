# HEX [PI] 7.0: the mathematics, with the learning loop

Anna Maria Sarkisyan · Evrica Technologies Inc. · engine version 7.0 on HEX6-BLE

Every step is given twice: first in plain words, then exactly, with the file
and function that computes it. Nothing in the plain-word paragraphs is a
simplification that the formal text contradicts. The same document, typeset,
is `docs/HEX-PI-7.0-mathematics.pdf`.

The whole engine is one equation,

$$\operatorname{logit} p_t \;=\; \operatorname{logit} q_{0,t} \;+\; \beta_t^\top Z_t ,$$

and one loop: **reveal, score, learn, predict, commit**.

| Symbol | Plain words | Code |
|---|---|---|
| $q_0$ | The null: what the series' own record already implies. Its usual odds | `observer.ts` |
| $Z$ | Where the present value sits among its surroundings | `hex7.ts: ranks` |
| $\beta$ | What HEX has learned on this series | `hex7.ts: Residual` |
| $p$ | HEX's call | `hex7.ts: walkHex7` |

---

## 1. The data and the two questions

**In plain words.** The engine never looks at raw values. It looks at how
much each value changed from the one before, and how big that change was
compared with what is usual for the series. It asks two yes-or-no questions
about the next step: *will the value go up?* and *will the change be bigger
than usual?*

**Exactly.** An adapter turns a series $x_0,x_1,\dots$ into changes $r_t$:
the log change $\ln(x_t/x_{t-1})$ when every value is positive, the plain
difference $x_t-x_{t-1}$ otherwise (`probabilityRead.ts: seriesToReturns`).
Everything after the adapter is the same for every kind of series. With
$a_t=|r_t|$ and $m_t=\operatorname{median}(a_1,\dots,a_t)$ for $t\ge 20$, the
two reads and their outcomes $y_{t+1}\in\{0,1\}$ are

$$\textsf{MOVE}:\ y_{t+1}=\mathbb 1[r_{t+1}>0],\qquad \textsf{RANGE}:\ y_{t+1}=\mathbb 1[a_{t+1}>m_t].$$

Everything computed at step $t$ uses values up to $x_t$ only (section 9
says how this is checked).

## 2. The null: what the series' own record implies

**In plain words.** Before anything else, the engine asks: how often has
this event happened on this series? "How often lately" and "how often ever"
can differ, so it keeps seven running tallies, each forgetting the past at a
different speed, and trusts each in proportion to how well it has predicted.
The trusted blend is the **null**, $q_0$: the series' usual odds. The null
never makes a call. It is what every call is measured against, so that HEX
gets no credit for what was already obvious.

**Exactly** (`observer.ts: observe`). For half-lives
$h\in\{32,64,128,256,512,1024,\infty\}$ with $\rho_h=2^{-1/h}$:

$$U_h\leftarrow\rho_hU_h+y,\qquad N_h\leftarrow\rho_hN_h+1,\qquad e_h=\frac{U_h+1}{N_h+2}.$$

Every estimate is kept within $[0.01,0.99]$.

For MOVE one more estimate is added, the position rule: if $A$ of the $n$
values so far lie above the present one, $e_{\rm pos}=(A+1)/(n+1)$, the exact
probability that the next value is higher when the order of the values
carries no information. Each estimate has a log-trust $\ell_k$, starting at
zero:

$$\ell_k\leftarrow\ell_k+\ln e_k(y),\qquad v_k=\frac{e^{\ell_k}}{\sum_je^{\ell_j}},\qquad q_0=\sum_kv_ke_k,$$

where $e_k(y)$ is $e_k$ if $y=1$ and $1-e_k$ otherwise. This is a Bayesian
mixture with a uniform prior: on any series its total log loss exceeds that
of the best single memory by at most $\ln M$, $M=7$ or $8$ (Vovk, 1990).

## 3. Where the present sits: the coordinates $Z$

**In plain words.** Is today's value high or low *compared with its recent
surroundings*? Take the last 8 values and ask where today's ranks among
them: lowest, highest, or in between. Do the same for the last 2, 4, 16, 32
and 64 values, and for the whole history. That gives seven numbers between
−1 (the lowest in its window) and +1 (the highest). They are computed for two
things: the level of the series, and the size of its latest change. A bitcoin
price, a temperature and a finishing position all become the same kind of
number: *where does this sit relative to what came before?*

Example: today's value is the 7th smallest of the last 8. Its coordinate at
that scale is $2(7-\tfrac12)/8-1=0.625$.

**Exactly** (`hex7.ts: ranks`). For window $w\in\{2,4,8,16,32,64\}$ let
$R_{t,w}$ be the midrank of $v_t$ among $v_{t-w+1},\dots,v_t$ (ties share the
average of their positions), and for all history $R_{t,\infty}$ its midrank
among $v_1,\dots,v_t$:

$$u_{t,w}=\frac{R_{t,w}-\tfrac12}{w},\qquad z_{t,w}=2u_{t,w}-1\in(-1,1).$$

A window that is not yet full gives $0$. Values are rounded to nine decimals
before ranking, so that a level returning exactly to an earlier level ranks
as a tie whatever arithmetic produced it. Two observables are ranked: the
level $v_t=\sum_{s\le t}r_s$ and the size $v_t=a_t$. For MOVE the level is
the read's own observable and the size is the other; for RANGE the reverse.
$Z_t\in\mathbb R^{14}$ is the own seven followed by the other seven.

If the series were exchangeable inside a window, $u_{t,w}$ would be uniform:
it is a probability integral transform, which is why the same coordinates
serve every kind of series. The sign $\mathbb 1[z>0]$ is a binary line; the
earlier engines kept only the sign and discarded the rest.

## 4. What HEX learns: the residual

**In plain words.** The null says 55%. HEX asks whether where the value sits
changes that. It learns one number per coordinate: how much being high at
that scale has pushed the odds up or down on this series. All of it starts at
zero, so on a new series HEX starts exactly at the null and departs from it
only as evidence arrives. The adjustment is made in odds, not percentage
points, so the result can never leave 0–100%.

Example: the null says 55%, which is odds of 0.55/0.45 = 1.22. HEX has
learned a coefficient of −0.3 at the 8-step scale, and today's coordinate
there is 0.625. The odds are multiplied by $e^{-0.3\times0.625}=0.83$, giving
1.01, or 50.3%: on this series, sitting high in the recent range has been
followed by fewer rises.

**Exactly** (`hex7.ts: Residual`). Two models: own ranks only ($\beta\in\mathbb R^7$)
and own with the other observable ($\beta\in\mathbb R^{14}$). Each is
Bayesian logistic regression with offset $\operatorname{logit}q_0$, updated
one outcome at a time by the second-order (assumed-density) step. With prior
$\beta\sim N(0,\tau I)$, covariance $P$ starting at $\tau I$, and
$q=\sigma(\operatorname{logit}q_0+\beta^\top Z)$ kept within $[0.01,0.99]$:

$$P\leftarrow P-\frac{q(1-q)\,PZZ^\top P}{1+q(1-q)\,Z^\top PZ},\qquad \beta\leftarrow\beta+PZ\,(y-q).$$

There is no learning rate to choose. The one free quantity, the prior scale
$\tau$, is a family: nine copies run at $\tau\in\{2^{-4},\dots,2^{4}\}$ and
are mixed by likelihood exactly as in section 2. The model's probability is
that mixture; the coefficients in force are the copies' coefficients
averaged by their weights (`Residual.beta`).

## 5. HEX's call: reversible influence

**In plain words.** Three voices answer every question: the null alone, the
model that reads the read's own coordinates, and the model that also reads
the other observable. HEX's call is their weighted average. A voice gains
influence by giving high probability to what actually happened. Influence is
never locked in: after every outcome a small slice of everyone's influence is
shared out equally, so a voice that has been wrong for a long time can come
back quickly when the series changes. What a voice has learned is never
erased; only its present say in the call moves.

**Exactly** (`hex7.ts: Share`). For experts $V=(q_0,m_1,m_2)$ and a share
rate $\alpha$:

$$w_k\leftarrow(1-\alpha)\,\frac{w_kV_k(y)}{\sum_jw_jV_j(y)}+\frac{\alpha}{3}$$

(fixed share; Herbster and Warmuth, 1998). Five rates
$\alpha\in\{0,0.001,0.005,0.02,0.05\}$ run side by side and are mixed by
likelihood; $\alpha=0$ is the plain Bayesian mixture, so the plain mixture is
one of the things HEX can fall back on, at a cost of at most $\ln 5$ in total
log loss. The call is

$$p=\sum_\alpha o_\alpha\sum_kw_{\alpha,k}V_k .$$

## 6. Strength: restated from the record, never changing the call

**In plain words.** A call has a side (yes or no) and a strength (how far
from 50%). The side is HEX's and is never changed. The strength is checked
against history: of all earlier calls stated at about 70%, how many were
right? If 66% were, a new 70% is shown as 66%. The shown strength can never
go below 50%, so the side cannot flip.

**Exactly** (`isotonic.ts`). With $a=\mathbb 1[p\ge\tfrac12]$ and
$s=\max(p,1-p)$, let $G$ be the isotonic regression of
$\mathbb 1[\text{call was right}]$ on $s$ over calls whose outcomes are
known, pooled across tracked series and refitted nightly (at least 2,000
calls). Then $s'=\min(0.99,\max(0.5001,G(s)))$ and the shown probability is
$s'$ if $a=1$, else $1-s'$. In the replay this left information gain
unchanged within noise and brought the strongest tenth of move-size calls
from stated 74.0% / right 69.6% to 69.8% / 68.8%. A map allowed to change the
side was tested and rejected: the calls it changed were right less often
afterwards (`validation/hex7.py`).

## 7. The measure: information gain

**In plain words.** Counting right and wrong treats a 51% call and a 99% call
the same. The engine is judged instead by how much probability it gave to
what actually happened, compared with how much the null gave. If HEX said 62%
and the null said 55% and the event happened, HEX gained; if it did not
happen, HEX lost. Added up over every call this is the information HEX has
contributed beyond the obvious, in bits. Positive and clear of zero means a
verified edge. Not clear of zero means **no verified edge**, and the product
says so.

**Exactly** (`cycle.ts: informationGain, clusteredMean`). For a call with
outcome $y$:

$$g=\ln p(y)-\ln q_0(y),\qquad G_T=\sum_{t\le T}g_t,\qquad \bar g=\frac{G_T}{T\ln 2}\ \text{bits per call}.$$

This is a proper score: its expectation is greatest when the true
probability is stated. Calls on the same day move together, so days are the
unit of uncertainty. For day totals $S_d$ over $n_d$ calls, $D$ days,
$N=\sum n_d$:

$$m=\frac{\sum_dS_d}{N},\qquad \operatorname{se}=\frac1N\sqrt{\frac{D}{D-1}\sum_d(S_d-m\,n_d)^2},\qquad \text{interval}=m\pm1.96\,\operatorname{se}.$$

The sums $\sum S_d,\ \sum S_d^2,\ \sum S_dn_d,\ \sum n_d^2$ are kept running,
so every decision uses the whole record without rereading it. The validation
report uses a block bootstrap over 20-day blocks instead; the two agree.

Recorded beside it for each call (`cycle.ts: scoreCall`):

- **closeness** $c=1-(p-y)^2$ (1 certain and right, 0.75 a coin flip), and the
  identity $c=0.75+[c(q_0)-0.75]+[c(p)-c(q_0)]+[c(p_{\rm shown})-c(p)]$:
  how much came from the null, from what HEX added, and from restating the
  strength;
- **reward** $\max(0,\,c-\bar c)$, the progress over the version's own
  average closeness $\bar c$ on that series, never negative; and **lesson**
  $\max(0,\,\bar c-c)$, kept for analysis and subtracted from nothing. No
  decision is taken on reward, because cutting off the downside would pay
  for boldness;
- **the reason for a miss**, from what each voice said before the outcome:
  `structure` (the null had it; what HEX added turned the call), `change`
  (shorter memories had it), `blip` (longer memories had it), `outvoted` (the
  position rule or one of HEX's models had it with too little influence),
  `unseen` (nothing the engine remembers pointed that way).

## 8. The loop

**In plain words.** Every night, for every series: see what happened; score
last night's calls; let memory take it in; make tonight's calls; write them
down before their outcomes exist. Then, across all series: refit the strength
map, decide which version people see, and decide which reads have a verified
edge.

**Exactly** (`functions/calibrateCognition`, `ledger.ts`).

1. **Reveal.** For each open call whose next bar has printed, compute $y$.
2. **Score.** Information gain, closeness, reward, lesson, reason
   (`scoreOpenCalls` → `scoreCall`).
3. **Learn.** The engine walks the series from its first bar, one step at a
   time (`walkHex7`): at each step it predicts, then takes the outcome into
   $U,N,\ell$ (section 2), $P,\beta$ and the prior-scale weights (section 4)
   and the influences $w,o$ (section 5). What it knows tonight is exactly
   what one pass through the series' history teaches it. Nothing else is
   stored between nights, so there is no state to corrupt or migrate.
4. **Predict.** Tonight's calls from both versions, with what each voice
   said and, for 7.0, the coefficients and influences in force.
5. **Commit.** Written to `CallLedger` before the outcome exists
   (`rowsFor`, `logCalls`).
6. **Strength map.** Refit $G$ per read and version from every scored step.
7. **Which version is shown.** Two versions run side by side: 7.0 and the
   frozen 6.5. On the same calls, with $m$ and its interval (section 7)
   computed for $\ln p_{7.0}(y)-\ln p_{6.5}(y)$: 7.0 is shown once there are
   at least 300 paired calls over 60 days, the interval is above zero, and
   7.0 is right at least as often. It is taken back down when the interval is
   below zero, or it is right less often by a margin clear of zero
   (`foldDays`, `decide`).
8. **Verified edge.** For the version shown, $m$ and its interval for
   information gain over the null. The status starts from the replay of
   section 9 (market move size verified, market direction not). The ledger's
   own record changes it only when it is decisive: to verified when the lower
   bound is above zero, to not verified when the upper bound is below zero.
   A read that is not verified is presented as having no verified edge
   (`probabilityRead.ts: verifiedLines`).

The precision metrics the loop keeps, per read, in one `EngineStatus` row:

| Field | Meaning |
|---|---|
| `bits_candidate`, `_low`, `_high` | 7.0's information gain over the null, bits per call, with its 95% interval |
| `bits_control`, `_low`, `_high` | the same for 6.5 |
| `gain`, `gain_low`, `gain_high` | 7.0 over 6.5 on the same calls, nats per call |
| `verified` | whether the shown version has a verified edge over the null (rule 8) |
| `hit_candidate`, `hit_control`, `hit_baseline` | share of calls right: 7.0, 6.5, and what the null alone gets (expected) |
| `stated_candidate`, `stated_control` | mean stated strength, to set beside the share right |
| `closeness_*`, `progress_*`, `lesson_*` | mean closeness, reward and lesson per call |
| `reasons_candidate`, `reasons_control` | misses counted by reason |
| `paired_calls`, `paired_days`, `live_engine`, `decision`, `reason` | the record's size and the version decision in words |

And per call, in `CallLedger`: `info_gain`, `log_score`, `closeness`,
`reward`, `lesson`, `reason`, the three parts of closeness, `views` (what
each voice said) and `learned` (7.0's coefficients and influences).

## 9. What has been measured

One-pass replay (`validation/replay.py`, specification and predictions in
`validation/prereg_replay.md`): every call made before its outcome, in order,
each series started from nothing. 280,252 calls on 43 series. Rerunning the
engine on truncated histories at 258 sampled points reproduced the ledger
with a largest difference of zero. The product code matches the reference to
$10^{-13}$ (`tests/parity.mjs`).

| | Calls | 7.0 right | Expected | Bits per call over the null [95%] | Over 6.5 [95%] |
|---|---|---|---|---|---|
| Markets, move size (17 series, 2016–2026) | 46,478 | 57.9% | 57.2% | +0.0043 [0.0030, 0.0056] | +0.0037 [0.0025, 0.0050] |
| Markets, direction | 46,478 | 51.4% | 51.2% | 0.0000 [−0.0007, 0.0006] | 0.0000 [−0.0007, 0.0006] |
| *Never used before:* 10 currencies, move size | 26,540 | 62.1% | 61.2% | +0.0082 [0.0060, 0.0106] | +0.0035 [0.0018, 0.0053] |
| *Never used before:* 10 currencies, direction | 26,540 | 54.2% | 54.0% | +0.0011 [−0.0002, 0.0025] | +0.0001 [−0.0013, 0.0014] |
| *Never used before:* 3 temperature stations, direction | 29,408 | 61.0% | 54.6% | +0.0465 [0.0430, 0.0499] | +0.0310 [0.0278, 0.0342] |
| *Never used before:* 3 temperature stations, move size | 29,408 | 63.1% | 61.6% | +0.0186 [0.0158, 0.0212] | +0.0130 [0.0109, 0.0153] |
| Chicago temperature, direction | 24,678 | 62.9% | 50.7% | +0.0644 [0.0598, 0.0689] | +0.0417 [0.0375, 0.0459] |
| Racing, direction | 13,022 | 74.8% | 75.0% | −0.0017 [−0.0020, −0.0014] | −0.0008 [−0.0015, −0.0003] |

- **Status.** Market move size: verified. Market direction: no verified edge.
- **Learning gain** (the engine left to learn against itself frozen after its
  first 500 calls on a series; the null keeps moving in both): +0.0036 bits
  per call [0.0025, 0.0048] on market move size, +0.0006 [0.0001, 0.0011] on
  market direction.
- **Experience.** Market move size, bits per call over the null by the number
  of calls already made on the series: −0.011 (1–100), +0.002 (101–250),
  +0.000 (251–500), +0.004 (501–1,000), +0.006 (1,001+). The first hundred
  calls on a new series cost information; the engine is level with the null
  by 500 and ahead after.
- **Which version the ledger shows.** The rule of section 8 switches market
  move size from 6.5 to 7.0 in late October 2019 and never back; it never switches
  market direction.
- **Racing direction** is the one read where HEX is behind the null: 7.0 by
  0.0017 bits per call and 6.5 by 0.0009. The null is already right three
  times in four there, and what either engine adds costs a little.

The 17-market run is a development backtest: those series were used while
designing every version. The ten currencies and three temperature stations
were never used before, and the rule for including them was written before
any run. Live calls from the release of 7.0 are the third test, and the
ledger collects them from the first night.

## 10. What is not claimed

- No guarantee of accuracy on any future series. Finite history cannot prove
  the future.
- The interval rules use a normal approximation over days. They are decision
  rules, not proofs.
- Market direction has no verified edge. Nothing in 7.0 fixes that, and the
  product does not pretend otherwise.
- The temperature replication is three stations; the currency replication
  includes one pegged-band currency and one in crisis, which were kept
  because the inclusion rule written beforehand kept them.
- Text, letter-number and ontology layers are not part of 7.0. No interaction
  term, call-changing calibration or interference model is either: each was
  tested (`validation/hex7.py`) and none added information.

## 11. The frozen comparator: 6.5

`hex.ts` is the previous engine, unchanged: each step leaves a binary line
per read; the last six lines form one of 64 states; evidence for the shift
$\delta_s$ in $p=q_0+\delta_s$ is filed under the state, shared between
neighbouring states by a kernel $\rho^{d}$ or its odd part
$\rho^d-\rho^{6-d}$ (a signed kernel shrinkage estimator), discounted, and
288 settings are mixed by likelihood. It runs beside 7.0 on every call so
that the comparison in section 8 is always paired and prospective. On market
move size its information gain over the null is +0.0006 bits per call; 7.0's
is +0.0043.

## References

- Ayer, Brunk, Ewing, Reid and Silverman (1955). An empirical distribution function for sampling with incomplete information. *Ann. Math. Statist.* 26.
- Brier (1950). Verification of forecasts expressed in terms of probability. *Monthly Weather Review* 78.
- Cesa-Bianchi and Lugosi (2006). *Prediction, Learning, and Games*. Cambridge University Press.
- Dawid (1984). Statistical theory: the prequential approach. *J. Roy. Statist. Soc. A* 147.
- Gneiting and Raftery (2007). Strictly proper scoring rules, prediction, and estimation. *J. Amer. Statist. Assoc.* 102.
- Herbster and Warmuth (1998). Tracking the best expert. *Machine Learning* 32.
- Opper (1998). A Bayesian approach to on-line learning. In *On-line Learning in Neural Networks*, Cambridge University Press.
- Vovk (1990). Aggregating strategies. *Proc. COLT*.
