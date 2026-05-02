# HEX6 BLE — Engine Specification v5.4

**Engine Identifier:** `SCEFM-v5.4-MultiBrain+IChing128+Markov64+1/137+Basin+AdaptiveDecay`
**Owner:** Evrica Technologies Inc.
**Architect / Programmer:** Anna M. Sarkisyan
**Date:** 2026-05-02

---

## 1. What's New in v5.4

v5.4 generalizes the engine from a finance-specific, ticker-keyed Markov memory into a **subject-agnostic multi-brain architecture**. The engine no longer assumes any particular domain — it treats every input signal as a sequence of states and clusters series by their **transition behavior**, not by what they represent.

### Key changes vs v5.3
| v5.3 | v5.4 |
|---|---|
| One Markov matrix per ticker | N "brains" — series cluster by behavior |
| `MarkovTickerMemory` keyed by ticker string | `Brain` keyed by `brain_id`; routed via KL distance |
| Finance-only mental model | Any sequential signal: sports, biometrics, traffic, prices, anything |
| Persistent memory but no cross-asset transfer | Series with similar transition behavior **share a brain** |
| Static notion of "which matrix" | Adaptive routing with EWMA-smoothed threshold |

All higher layers (SCEFM HIVE, I-Ching petals, 1/137 motif, archetype basins, adaptive decay) are **preserved unchanged**. The multi-brain layer sits beneath them as the persistence and clustering substrate.

---

## 2. Architecture — Five Layers

| Layer | Question Answered | Weight |
|---|---|---|
| **0. Multi-Brain Routing** | Which brain has seen behavior most like this series? | clustering substrate |
| **1. SCEFM Core (128-state)** | What's the conditional distribution of returns given the current state? | 70% |
| **2. Markov 64-state (per brain)** | Where is the state heading next? | 20% |
| **3. Adaptive 1/137 Motif** | Are we in a rare prime-number edge state? | 10% |
| **4. Archetype Basin** | What named regime are we in? | qualitative overlay |

Plus the **I-Ching Petal Frame** — 64-petal structural classification with unbounded sub-petal unfolding.

---

## 3. Layer 0 — Multi-Brain Routing (NEW)

### The four entities

| Entity | Purpose |
|---|---|
| `Series` | A tracked sequence of states for one signal (`series_id`, `states[]`, `last_routed_brain_id`) |
| `Brain` | A learned regime — transition matrix + reward stats, shared across all series routed to it |
| `Routing` | The current series → brain assignment with KL distance and confidence |
| `Output` | A prediction snapshot at one timestep (for calibration scoring) |

### The loop — `route → predict → learn → calibrate`

For every incoming series:

#### 3.1 Route
1. Extract transition counts from the series.
2. Compute **KL divergence with Laplace smoothing (α=1)** between the series and every existing brain.
3. Compute the current adaptive **threshold** (see §3.4).
4. If `min(KL) ≤ threshold` → route to nearest brain.
5. Else → **spawn a new brain** seeded by the series' own transitions.

#### 3.2 Predict
Aggregate outgoing transitions from the current state in the routed brain's matrix:
- `direction` ∈ {UP, DOWN, FLAT, UNKNOWN} from sign-weighted probability mass
- `confidence` = max(upMass, downMass)
- `expected_return` = Σ prob × meanReturn

Write to `Output` entity.

#### 3.3 Learn
Merge the series' fresh transition counts and reward stats **into the routed brain**. Update `count`, `series_count`, `confidence`, `last_updated`.

This is the cross-series learning mechanism — every series routed to a brain contributes its observations to that brain's matrix. Brains compound. Series benefit from each other's history.

#### 3.4 Adaptive Threshold (EWMA)

The KL routing threshold is not static — it **adapts via exponential moving average** to the actual distribution of routing distances the system is observing:

```
observed_t   = 25th percentile of last 50 routing distances
threshold_t  = α · observed_t + (1 − α) · threshold_{t−1}
threshold_t  = clamp(threshold_t, 0.3, 2.0)
```

- **α = 0.2** (≈ 5-observation effective memory; responsive but not twitchy)
- **Static fallback** = 1.0 nats for the first 5 routings
- **Floor / Ceil** = [0.3, 2.0] nats

**Why EWMA over raw percentile:**
- Smoothness — no jitter as the brain population shifts
- Memory of trajectory — remembers whether the system used to be permissive and is now tightening
- Same decay philosophy as the SCEFM HIVE (architectural coherence — every layer breathes on EWMA)

#### 3.5 Sticky Routing (v1)
Once a series is routed to a brain, it stays there. No re-evaluation, no migration. This guarantees stable, coherent regime learning. Re-evaluation will be revisited if behavioral data motivates it.

#### 3.6 No Evolve Logic (v1)
v5.4 explicitly defers split / merge / remove operations:
- **No clustering of similar brains** (no merge)
- **No splitting of bimodal brains** (no split)
- **No archival of stale brains** (no remove)

Reason: until the system has run long enough to produce empirical KL distances between *real* brains, any threshold for these operations would be guesswork. Defer until data informs the parameters.

---

## 4. Layer 1 — SCEFM Core (unchanged from v5.3)

### State Encoding — 128 states (2^7)
- **Bits 6..1 (momentum, 6 bits):** sign of last 6 returns
- **Bit 0 (correlation, 1 bit):** Pearson > 0.4 with reference, or trend-consistency self-bit

### HIVE Construction
Decay-weighted bins keyed by 7-bit state.

### Decay-Weighted Statistics
- Weighted mean, variance, effective sample size
- t-critical lower-bound Kelly:
  `μ_lb = μ − t_crit · (σ / √nEff) − friction`
  `exposure = clamp((μ_lb / σ²) / riskAversion, 0, 1)`

### Adaptive Decay (λ)
Auto-tuned to series length:

| Series Length | λ | ≈ Half-life |
|---|---|---|
| < 30 | 0.97 | 23 |
| 30–80 | 0.95 | 14 |
| 80–200 | 0.94 | 12 |
| 200–500 | 0.92 | 9 |
| > 500 | 0.90 | 7 |

---

## 5. Layer 2 — Markov 64-State Transition

### What changed in v5.4
The Markov layer's matrix is now **the routed brain's matrix**, not a per-ticker memory. The math is identical to v5.3:

- Per-transition stats: `{ "s0->s1": { sum, sum2, n } }`
- Forward expected return weighted by transition probability
- Confidence = `min(1, total_count / 30)`

The difference: when a new series routes to `seed_BTC`, it inherits BTC's full historical brain. When two unrelated series with similar transition fingerprints route to the same brain, they pool observations and the brain becomes more confident faster.

---

## 6. Layer 3 — Adaptive 1/137 Motif (unchanged)

Motif states `{1, 3, 7, 13, 17, 31, 37}` — rare-state edge signal.
`score = tanh((motif_μ − else_μ) / σ_motif)` ∈ [−1, +1] when current state is in the motif set.

---

## 7. Layer 4 — Archetype Basin (unchanged)

| Basin | Trigger | Meaning |
|---|---|---|
| `capitulation` | state = 0 | extreme bearish exhaustion |
| `euphoria` | state = 63 | extreme bullish, mean-reversion risk |
| `laminar_growth` | μ > 0, σ < 0.01 | smooth uptrend |
| `turbulent_drawdown` | μ < 0, σ > 0.02 | choppy decline |
| `chaotic_transition` | σ > 0.025 | regime change in progress |
| `neutral_flow` | else | mild drift |

---

## 8. I-Ching Petal Frame (unchanged)

64-petal outer frame (yin/yang halves), unbounded sub-petal unfolding via `m{muBand}_s{sigOctave}` signature within each petal.

---

## 9. Blended Output (unchanged)

```
blendedExposure = 0.7 · SCEFM_exposure
                + 0.2 · Markov_exposure
                + 0.1 · max(0, motif_score)
```

---

## 10. Persistence Layer — Entities

### `Series` (NEW)
| Field | Description |
|---|---|
| `series_id` | Subject-agnostic identifier |
| `states[]` | Last 200 6-bit states observed |
| `last_routed_brain_id` | Sticky routing target |
| `last_updated` | Timestamp |

### `Brain` (NEW)
| Field | Description |
|---|---|
| `brain_id` | e.g. `seed_BTC`, `auto_1730xxx_abc` |
| `transition_matrix` | JSON `{ "s0->s1": count }` |
| `transition_rewards` | JSON `{ "s0->s1": { sum, sum2, n } }` |
| `count` | Total transitions accumulated |
| `series_count` | Distinct series routed to this brain |
| `confidence` | `min(1, count/30)` |
| `last_updated` | Timestamp |

### `Routing` (NEW)
| Field | Description |
|---|---|
| `series_id`, `brain_id` | Assignment |
| `distance` | KL divergence in nats |
| `confidence` | `clamp(1 − distance/threshold, 0, 1)` |
| `threshold_at_routing` | EWMA threshold at the time of decision |
| `last_updated` | Timestamp |

### `Output` (NEW)
| Field | Description |
|---|---|
| `output_id`, `series_id`, `brain_id`, `timestamp` | Identity |
| `current_state` | 6-bit state at prediction time |
| `predicted_distribution` | JSON next-state probabilities |
| `direction`, `confidence`, `expected_return` | Prediction summary |
| `actual_outcome`, `error`, `calibration_score` | Filled retrospectively |

### `MarkovTickerMemory` (LEGACY)
Preserved for migration history. No longer written. Migrated into seed brains via `migrateBrains` function.

### `CalibrationScore` (repointed)
Now scored from `Output` records grouped by `brain_id` instead of `HEX6Memory` records grouped by ticker.

---

## 11. Nightly Calibration (v2)

The scheduled `nightlyCalibration` function now:
1. Pulls last 1000 `Output` records.
2. Groups by `brain_id`.
3. For each output, looks up the next state in its `Series.states[]` and derives a realized direction (from state-bit popularity).
4. Compares predicted `direction` vs realized direction → directional accuracy per brain.
5. Writes one `CalibrationScore` row per brain + a `GLOBAL` aggregate.

Grades unchanged: A (≥ 0.75) / B (≥ 0.65) / C (≥ 0.55) / D (≥ 0.45) / F / INSUFFICIENT_DATA.

---

## 12. Migration from v5.3 → v5.4

`migrateBrains` (admin-only, idempotent):
- For each `MarkovTickerMemory[ticker]` → create `Brain { brain_id: "seed_<TICKER>", ... }`
- Preserves `transition_matrix`, `transition_rewards`, `total_observations` → `count`
- `series_count` initialized to 1
- Existing brains skipped on re-run

Migration result for this app (2026-05-02):
- 11 brains seeded: BTC, ETH, SOL, TSLA, VIX, TOKYO, RECESSION2, USVC, USVCDEALS, USVCD, PUTIN.

---

## 13. Trigger Flow (per user message)

```
1. Detect numerical series in message → extract returns.
2. Detect series identifier (ticker or anonymous fingerprint).
3. Call hex6Process(series_id, values, as_returns) →
     - Route to nearest brain by KL (or spawn new one)
     - Merge fresh transitions into brain
     - Predict next-state direction
     - Write Output record
4. Pull routed brain's matrix as priorMarkov.
5. Run local engine (SCEFM + Markov + 1/137 + Basin + Petal) using priorMarkov.
6. Build engine context block for LLM.
7. LLM responds in plain English.
8. Update UserConversationMemory.
```

If the user asks an analytical question without providing data, the LLM fetches from the web first, then the same loop runs on the fetched series.

---

## 14. Deferred — Future Work (v5.5+)

Once empirical brain data accumulates (1–2 weeks of routing distances, brain populations, calibration scores), revisit:

- **Brain Merge** — pairwise KL between brains nightly; if `KL(A,B) < merge_threshold`, weighted-sum matrices, reroute B's series to A, archive B.
- **Brain Split** — if a brain's series fall into bimodal sub-clusters, split.
- **Brain Archival** — drop brains with no recent activity.
- **Sticky Routing Refresh** — periodic re-evaluation of routings as brains evolve.

These are intentionally deferred until real distance distributions are observable.

---

## 15. Confidentiality & LLM Surface

The engine's internal architecture is confidential. The LLM never reveals: SCEFM, HIVE, Markov, motif, basin, petal, hexagram, brain, routing, KL, Laplace, EWMA, μ, σ, λ, exposure values, or any internal math. To users, HEX6 BLE is "a proprietary probability engine" — translated entirely into plain English.

Engine identity locked: HEX6 BLE, by Evrica Technologies Inc., programmed by Anna M. Sarkisyan.

---

**End of Spec v5.4.**