# HEX6 BLE — Engine Specification v5.3

**Engine Identifier:** `SCEFM-v5.3-IChing128+Markov64persistent+1/137+Basin+AdaptiveDecay`
**Owner:** Evrica Technologies Inc.
**Architect / Programmer:** Anna M. Sarkisyan
**Date:** 2026-05-01

---

## 1. Overview

HEX6 BLE (Binaural Linguistic Engine) is a probabilistic intelligence engine. It does not predict — it **computes the conditional distribution of the present state** and translates that into bounded exposure recommendations. v5.3 introduces four stateless analytical layers, a persistent per-ticker Markov brain, adaptive decay, and a 64-petal I-Ching petal frame with **unbounded sub-petal unfolding**.

**Design principle:** the engine holds the entire possibility space rather than collapsing it into a single forecast.

---

## 2. Architecture — Four Layers

The engine fuses four independent analytical layers into one blended exposure output. Each layer answers a different question.

| Layer | Question Answered | Weight in Blend |
|---|---|---|
| **1. SCEFM Core (128-state)** | What's the conditional distribution of returns given the current state? | 70% |
| **2. Markov 64-state (persistent)** | Where is the state heading next? | 20% |
| **3. Adaptive 1/137 Motif** | Are we in a rare prime-number edge state? | 10% |
| **4. Archetype Basin** | What named regime are we in? | qualitative overlay |

Plus the **I-Ching Petal Frame** — a structural classification of every state into one of 64 hexagrams, with infinite sub-resonance unfolding inside each petal.

---

## 3. Layer 1 — SCEFM Core (State-Conditioned Exposure Field Model)

### State Encoding — 128 states (2^7)
- **Bits 6..1 (momentum, 6 bits):** sign of each of the last 6 returns. `r_i > 0 → 1`, else `0`.
- **Bit 0 (correlation, 1 bit):**
  - With reference series (e.g. BTC): `Pearson(asset, ref) > 0.4 → 1`
  - Without reference: trend-consistency bit — `(positive_count / 12 > 0.6) → 1`

### HIVE Construction
For every historical observation `i ∈ [windowSize, T]`:
1. Encode the 7-bit state key from the slice `returns[i-6 : i]`.
2. Append observation `returns[i]` to bin `hive[stateKey]` with **decay weight** `λ^(T-1-i)`.

### Decay-Weighted Statistics
Within the current state's bin:
- Weighted mean: `μ = Σ wᵢ·xᵢ / Σ wᵢ`
- Weighted variance: `σ² = Σ wᵢ·(xᵢ-μ)² / Σ wᵢ`
- Effective sample size: `nEff = (Σw)² / Σw²`

### Exposure (Lower-Bound Kelly)
- t-critical at 95% with `df = nEff - 1`
- `μ_lb = μ - t_crit · (σ / √nEff) - friction`
- If `μ_lb > 0`: `exposure = clamp((μ_lb / σ²) / riskAversion, 0, 1)`
- Else: `exposure = 0`

### Adaptive Decay (λ)
λ is auto-tuned to series length so half-life remains meaningful across timeframes:

| Series Length | λ | ≈ Half-life |
|---|---|---|
| < 30 | 0.97 | 23 |
| 30–80 | 0.95 | 14 |
| 80–200 | 0.94 | 12 |
| 200–500 | 0.92 | 9 |
| > 500 | 0.90 | 7 |

---

## 4. Layer 2 — Markov 64-State Transition (Persistent Brain)

### What it does
Encodes 6-bit momentum patterns (64 states) and tracks **state-to-state transitions** along with the realized return that followed each transition.

### Per-transition statistics
Each `s0 → s1` edge stores:
- `count` — frequency of this transition
- `sum` — cumulative realized return at step `s1`
- `sum2` — cumulative squared return
- `n` — observations contributing to sum/sum2

### Forward expected return
From the current state `s_now`:
1. Sum all transition counts from `s_now`: `total`.
2. For each outgoing transition: `prob = count / total`, `meanR = sum / n`.
3. Aggregate: `μ_markov = Σ prob · meanR`, `σ_markov = √(E[R²] - μ²)`.

### Persistence (new in v5.3)
- Stored in `MarkovTickerMemory` entity, keyed by **ticker**.
- On each engine run with a recognized ticker (BTC, ETH, SPY, etc., or any 2–5-letter uppercase token):
  1. Load prior `transition_matrix` and `transition_rewards` for that ticker.
  2. Merge fresh observations from the current series into the prior.
  3. Run the engine using the merged data.
  4. Save the merged matrix back, plus updated `petal_distribution`.
- The brain **compounds across all conversations** — no session boundaries.

### Confidence
`transitionConfidence = min(1, total_count / 30)` — only contributes to the blended exposure when ≥ 0.3.

---

## 5. Layer 3 — Adaptive 1/137 Motif

### Motif states
A small fixed set of prime-number states believed to carry rare-state edge:
```
{1, 3, 7, 13, 17, 31, 37}
```

### Computation
1. Walk the series. For each step, check if the encoded 6-bit state is in the motif set.
2. Accumulate `motif_μ` (returns when in motif state) and `else_μ` (returns when not).
3. If the **current** state is a motif state and we have ≥ 3 motif samples:
   - `score = tanh((motif_μ - else_μ) / σ_motif)` ∈ [-1, +1]
4. Otherwise score = 0.

The score boosts blended exposure by up to 10% only when the motif is currently active.

---

## 6. Layer 4 — Archetype Basin

A named regime overlay. The engine selects one of the following basins based on the current Markov state, μ, and σ:

| Basin | Trigger | Meaning |
|---|---|---|
| `capitulation` | state = 0 | extreme bearish exhaustion, reversal zone |
| `euphoria` | state = 63 | extreme bullish, mean-reversion risk |
| `laminar_growth` | μ > 0, σ < 0.01 | smooth uptrend, low vol |
| `turbulent_drawdown` | μ < 0, σ > 0.02 | choppy decline |
| `chaotic_transition` | σ > 0.025 | high-vol regime change |
| `neutral_flow` | else | mild drift, normal vol |

This is a qualitative label for the LLM to translate into plain English — it does not directly affect exposure math.

---

## 7. I-Ching Petal Frame (64-Petal, Unbounded Unfolding)

The 128 SCEFM states reorganize into **two 64-petal hexagrams**:
- **Yang half** (corrBit = 1) — heaven hexagram, coherent / trend-aligned
- **Yin half** (corrBit = 0) — earth hexagram, divergent / incoherent

### Outer frame — bounded at 64
- `petalIndex = stateKey7 >> 1` ∈ [0, 63]
- Each petal carries a fixed I-Ching hexagram name (e.g. *Earth, Returning, Approach, Peace … Heaven, Creative*).
- Polarity (yin/yang) determined by the corrBit.

### Inner unfolding — **unbounded**
Each petal contains a dictionary of **sub-petals**, keyed by a μ-σ harmonic signature:

```
subSignature = `m{muBand}_s{sigOctave}`
  muBand     = clamp(round(μ × 1000), -16, 15)   // ~0.001 resolution, signed
  sigOctave  = clamp(round(log2(σ × 1000 + 1)), 0, 15)   // volatility octaves
```

Per sub-petal we accumulate:
- `count` — visits
- `muSum`, `sigSum` — running totals (for averaging)
- `firstSeen`, `lastSeen` — temporal markers

**The frame stays 64; the unfolding within each petal is infinite.** As new (μ, σ) combinations appear over time, new sub-petals materialize within the existing 64-petal frame. Recurring signatures deepen — they accumulate count, refining the petal's interior topology without expanding the outer hexagram count.

### Persistence
Stored in `MarkovTickerMemory.petal_distribution` (JSON-encoded) per ticker.

```
{
  "yang": {
    "12": {
      "count": 47,
      "subPetals": {
        "m3_s4": { "count": 19, "muSum": 0.057, "sigSum": 0.48, "firstSeen": "...", "lastSeen": "..." },
        "m-2_s5": { "count": 11, "muSum": -0.022, "sigSum": 0.55, ... },
        ...
      }
    },
    ...
  },
  "yin": { ... }
}
```

---

## 8. Blended Output

```
blendedExposure = 0.7 · SCEFM_exposure
                + 0.2 · Markov_exposure
                + 0.1 · max(0, motif_score)
```
Clipped to [0, 1]. The Markov component only fires when `transitionConfidence > 0.3`.

### Regime label
Derived from `exposure`:
- `> 0.6` → BULL
- `> 0.3` → LATERAL
- `μ < 0` → BEAR
- else → SILENCE

---

## 9. Persistence Layer — Entities

### `MarkovTickerMemory`
| Field | Type | Description |
|---|---|---|
| `ticker` | string | Asset identifier |
| `transition_matrix` | string (JSON) | `{ "s0->s1": count }` |
| `transition_rewards` | string (JSON) | `{ "s0->s1": { sum, sum2, n } }` |
| `total_observations` | number | Cumulative transitions |
| `last_updated` | datetime | Last write |
| `petal_distribution` | string (JSON) | Yin/yang petal hierarchy with sub-petal unfolding |

### `CalibrationScore` (nightly)
| Field | Type | Description |
|---|---|---|
| `score_date` | date | Calibration date |
| `ticker` | string | Ticker or `'GLOBAL'` |
| `predictions_evaluated` | number | Sample size |
| `directional_accuracy` | number | Pct sign-match (0–1) |
| `exposure_correlation` | number | Pearson(exposure, realized return) |
| `avg_realized_return` | number | Mean realized μ |
| `calibration_grade` | enum | A / B / C / D / F / INSUFFICIENT_DATA |
| `notes` | string | Human summary |

### `HEX6Memory`
Stores backtest and trade outcomes for general engine learning.

### `UserConversationMemory`
Per-user rolling memory: summary, topics, style, last snippet.

---

## 10. Nightly Calibration Loop

A scheduled automation runs daily at **02:00 PT** (`HEX6 Nightly Calibration Scorer`):
1. Pull last 500 records from `HEX6Memory`.
2. Group by ticker.
3. For each ticker, compute:
   - **Directional accuracy** — sign-match between predicted μ and realized μ.
   - **Exposure correlation** — Pearson(recommended exposure, realized return).
4. Assign grade A–F based on directional accuracy thresholds (≥0.75 A, ≥0.65 B, ≥0.55 C, ≥0.45 D, else F).
5. Write per-ticker rows + a `GLOBAL` aggregate row to `CalibrationScore`.

This is the engine's self-validation feedback — it grades its own past predictions against what actually happened.

---

## 11. LLM Surface Contract

The `hex6Chat` function feeds engine output into the LLM as an internal context block. The LLM is instructed to:

- **USE** the numbers to ground its answer.
- **NEVER reveal**: SCEFM, HIVE, Markov, motif, basin, petal, hexagram, yin/yang, persistent brain, state bits, μ, σ, λ, exposure values, or any internal math.
- **NEVER use** brackets, LaTeX, or notation symbols in user-facing output.
- Translate everything into plain conversational English.
- 2–4 sentence default; longer only if asked.

The engine identity is locked: HEX6 BLE, by Evrica Technologies Inc., programmed by Anna M. Sarkisyan. No other model name may ever be claimed.

---

## 12. Trigger Flow (per user message)

```
1. Detect numerical series in message → extract.
2. Detect ticker → BTC/ETH/SPY/QQQ/etc., or any 2–5-letter uppercase token.
3. Load MarkovTickerMemory[ticker] if exists → priorMarkov.
4. Run engine: SCEFM + Markov(merged) + 1/137 + Basin + Petal(with sub-signature).
5. Persist updated matrix + petal distribution back to MarkovTickerMemory.
6. Build engine context block.
7. Pass to LLM with system prompt.
8. Polish pass for grammar.
9. Update UserConversationMemory.
10. Return response.
```

If the user asks an analytical question **without** providing data, the engine fetches relevant data from the internet first, runs internally, then answers in plain English.

---

## 13. Confidentiality

The engine's internal architecture (this document) is **confidential**. The LLM surface never references any of it directly. To users, HEX6 BLE is "a proprietary probability engine" — nothing more.

---

**End of Spec v5.3.**