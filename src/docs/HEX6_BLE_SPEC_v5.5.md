# HEX6 BLE — Engine Specification v5.5

**Engine Identifier:** `SCEFM-v5.5-Unified(Reason+Understand)+WalkForwardCalibration`
**Base:** v5.4 (`MultiBrain+IChing128+Markov64+1/137+Basin+AdaptiveDecay`) — fully preserved.
**Owner:** Evrica Technologies Inc.
**Architects / Programmers:** Anna M. Sarkisyan, Blake Rice
**Date:** 2026-07-22

---

## 1. What's New in v5.5

v5.5 unifies the engine into a **single cognitive loop** and grounds it in a measured, out-of-sample accuracy record. The v5.4 multi-brain substrate is kept intact; v5.5 sits above it as the intelligence + calibration layer.

### Key changes vs v5.4
| v5.4 | v5.5 |
|---|---|
| One operator (structural probability only) | **Dual-operator Cognitive DNA**: Reason (HEX6-BLE) + Understand (PI-US), one loop |
| Engine outputs a numeric block for the LLM | Engine emits a semantic **Thinking State** (Topology → Resonance → Support → Decision) |
| Fixed persona instructions in `hex6Chat` | The v5.4 HEX6-BLE prompt is carried into the unified `think` function + a **value-calibrated tone** line, a **PURPOSE** block, and an injected **USER CONTEXT** block (memory + nightly calibration) |
| Directional accuracy only (in-engine forward test) | **Walk-forward calibration** of Probability *and* Value vs realized outcomes |
| No measured accuracy baseline | **Recorded baseline**: BTC 2y walk-forward, 87.9% directional accuracy |

All v5.4 layers (Multi-Brain Routing, SCEFM Core, Markov 64, 1/137 Motif, Archetype Basin, I-Ching Petals, Adaptive Decay) are **preserved unchanged** (see Spec v5.4 §3–§9).

---

## 2. Architecture — The Unified Cognitive Loop

One organism, one sequence. Two operators ask different questions of the same data:

| Operator | Layer | Question | Output |
|---|---|---|---|
| **Reason** (HEX6-BLE) | structural / probabilistic | "What is *possible*?" | probability, exposure, regime |
| **Understand** (PI-US) | waves / frequency / meaning | "What is *meaningful*?" | resonance, value (Pascal support) |

The two never override each other — they **cross-check** and fuse through **Pascal Validation**, the judge that gates confidence by structural *support*, not loudness.

```
              ┌──────────── Reason (HEX6-BLE) ────────────┐
  returns ───▶│ SCEFM · Markov · 1/137 · Basin · Petals  │── probability, exposure, regime
              └──────────────────────────────────────────┘
              ┌─────────── Understand (PI-US) ───────────┐
  returns ───▶│ Wave layer (FFT) · Resonance · Archetype  │── resonance, ripple, tone
              └──────────────────────────────────────────┘
                              │
                              ▼
                ┌──── Pascal Validation (judge) ────┐
                │ evidence × agreement × consistency │
                │          × coverage = SUPPORT      │── confidence, direction
                └────────────────────────────────────┘
                              │
                              ▼
                Thinking State (semantic) → LLM (v5.4 prompt + tone) → response
```

Implementation: `base44/shared/thinkingEngine.ts` (shared by the `think` function).

---

## 3. Reason Layer (HEX6-BLE) — preserved v5.4 math

`runReasonLayer(returns)` runs the full v5.4 stack (SCEFM 128-state HIVE + Markov 64 + 1/137 motif + Basin + adaptive decay + multi-resolution hive) and returns:
- `mu`, `sigma`, `exposure`, `blendedExposure`, `nEff`, `regime`, `basin`, `resolution`, `lambda`
- `markov` edge `{ mu, sigma, n, confidence, currentState }`
- `motif` `{ score, isActive }`

**Contingency-weighted friction** (v5.5 refinement): the honesty hurdle scales with structural contingencies rather than a fixed bps floor:
```
evidenceWeight = min(1, nEff/30) × (resolution/7)
adaptiveFriction = sigma × (1 − evidenceWeight)
muLb = mu − tCrit·(sigma/√nEff) − adaptiveFriction
```
Strong evidence at fine resolution drives friction → 0 (real edges surface); thin or coarse evidence keeps friction near one full sigma (SILENCE stays honest).

---

## 4. Understand Layer (PI-US) — waves & resonance

`runWaveLayer(returns)` treats the series as a signal:
- Discrete spectrum (DFT) → dominant frequency, period, spectral concentration
- `resonance = tanh(concentration·3) · min(1, amplitude·2)` — coherence of the dominant wave
- `phaseAlignment` — phase coherence at the prediction point

`runArchetypeLayer` fuses resonance with the HEX6 basin to read the emotional tone and how to steer (harmonize toward).

---

## 5. Pascal Validation — the judge

`runValidationLayer(reason, wave)` — a conclusion earns confidence only when all four pillars are strong; the product rewards balanced, well-supported reads over isolated peaks.

| Pillar | Measures |
|---|---|
| **Evidence** | sample size + transition reliability |
| **Agreement** | probability ↔ resonance alignment |
| **Consistency** | phase coherence over time |
| **Coverage** | spectral concentration (does it explain the signal?) |

```
support     = evidence × agreement × consistency × coverage
confidence  = (evidence × agreement × consistency × coverage)^(1/4)
direction   = UP / DOWN / FLAT  (from μ sign)
```

**Cross-Check**: HEX6-BLE and PI-US critique each other (`runCrossCheck`) — directional alignment and friction are reported, surfacing regime turns.

---

## 6. Thinking State → LLM (the v5.5 voice pipeline)

The engine computes; `buildThinkingState` + `renderThinkingState` translate numbers into a semantic block the LLM receives:

```
THINKING STATE
Topology:     possibility · uncertainty · regime · resolution · strongest_path
Resonance:    resonance · contextual_fit · agreement · dominant_rhythm
Support:      support · confidence · direction
Context:      novelty · consistency · friction
Archetype:    state · pattern_scope · ripple · forward · emotional_tone · harmonize_toward
Decision:     primary_conclusion · alternative_conclusions · confidence · why · tradeoffs · steer
Cross-Check:  directional_alignment · friction · hex6_ble_critique · pi_us_critique
Forward Test: directional_accuracy · friction
```

### The prompt (v5.4 carried forward + v5.5 adaptive layer)
- **Identity surfaced to users**: "The Model (v5.5), developed by Evrica Technologies Inc., created by Anna Sarkisyan and Blake Rice." Internal engine identity remains HEX6 BLE.
- **Persona + behavior = the v5.4 HEX6-BLE prompt** (carried from `hex6Chat`): the "Renaissance Tech meets a brilliant friend at 2am over whiskey" persona, the ABSOLUTE GROUND RULES, SNIPER PRECISION, show-reasoning, take-a-stance, plain-English rules. PI-US LLM identity/behavior instructions are **removed**.
- **v5.5 adds a PURPOSE block** — framing the smooth application of internal processes: greet and read emotional state, run probability (HEX6-BLE) and value/reasoning (PI-US), tailor voice, steer toward the user's highest good individually and collectively.
- **v5.5 adds a value-calibrated tone line**:
  `VOICE: {register} — calibrated to the model's structural support, tone only.`
  The register (`warm and certain` / `clear and analytical` / `open and curious` / `conversational, professional, friendly`) is selected by `toneDescriptor(validation)` → `selectVoice(tone)`.
- **v5.5 injects a USER CONTEXT block** — the user's stored memory (`memory_summary`, `user_style`, `topics_discussed`) and their nightly `calibration_state` are injected so The Model can adapt voice and steering to the user. A no-fabrication guardrail (ground rule #3) permits genuine recall of shared history but forbids inventing specifics not present in USER CONTEXT or the visible CONVERSATION.

So the user sees the **v5.4 format** with an adaptive layer: tone calibration + per-user memory/calibration context — the PI-US value layer contributes the register, and the nightly calibration contributes the per-user steering context.

---

## 7. Walk-Forward Calibration (NEW — measured accuracy)

The in-engine `runForwardTest` measures directional accuracy only. v5.5 adds a dedicated walk-forward that measures how well **Probability** and **Value (Pascal support)** calibrate to realized outcomes.

### Protocol (`walkForwardAccuracy` function)
1. Take a returns series (supplied or fetched live by ticker — ~2y daily).
2. Split 80/20. For each out-of-sample step, train on the **expanding prefix** (no look-ahead):
   - `reason = runReasonLayer(prefix)`
   - `wave = runWaveLayer(prefix)`
   - `validation = runValidationLayer(reason, wave)`
3. Record predicted `probability` (exposure), `value` (support), `direction` (μ sign); compare to the realized next return.
4. Report:
   - **directionalAccuracy** — fraction of correct direction calls
   - **probabilityCalibration** — Pearson(probability, realized return)
   - **valueCalibration** — Pearson(support, realized return)
   - tier accuracy & mean return for high- vs low-value / high- vs low-probability predictions
   - **friction** = 1 − directionalAccuracy

### Recorded baseline — BTC, 2-year walk-forward (2026-07-22)

| Metric | Value |
|---|---|
| Series length | 495 daily returns |
| Train / Test | 396 / 99 |
| **Directional accuracy** | **87.9%** |
| **Friction** | 0.121 |
| Probability calibration (Pearson) | +0.12 |
| **Value (Pascal support) calibration** | **+0.20** |
| High-probability accuracy | 0.78 |
| Low-probability accuracy | 0.98 |
| High-probability mean return | +0.21% / day |
| Low-probability mean return | −0.43% / day |

**Findings:**
- **Value calibrates to outcomes better than probability alone** (+0.20 vs +0.12) — validating the PI-US Pascal support layer as a stronger discriminator than raw exposure.
- **High-probability calls are profitable** (+0.21%/day) while low-probability calls lose (−0.43%/day) — probability discriminates PnL.
- The engine is honest: low-value/SILENCE days still rode the BTC uptrend (high directional accuracy there is uninformative — the edge lives in the high-value tier).

Recorded to `HEX6Memory` (memory_type = `backtest`, ticker = `BTC`).

---

## 8. Persistence — what's recorded

| Entity | v5.5 role |
|---|---|
| `CognitiveState` | One row per thinking cycle (probability, resonance, value, confidence, friction, forward_accuracy, cross_alignment) — now `user_email`-attributed so nightly calibration can derive per-user states |
| `HEX6Memory` | Backtest / signal / feedback records (the walk-forward baseline above) |
| `Series` · `Brain` · `Routing` · `Output` | v5.4 multi-brain substrate — unchanged |
| `CalibrationScore` | Nightly per-brain + GLOBAL calibration grades |
| `UserConversationMemory` | Cross-session summary (`memory_summary`, `user_style`, `topics`) + nightly `calibration_state` — now injected as the USER CONTEXT block for per-user adaptation, with a no-fabrication guardrail |

---

## 9. Trigger Flow (per user message) — `think` function

```
1. Auth → read message + history + files.
2. If inline numerical data detected → run engine immediately → Thinking State.
3. Triage: casual → respond in v5.4 voice (no web, no engine).
4. Analytical → web fetch (real series) → run engine → Thinking State.
5. Compose: v5.4 prompt + VOICE line + Thinking State + CONVERSATION.
6. InvokeLLM → response (+ sources).
7. Save CognitiveState (user-attributed via `user_email`); update UserConversationMemory. Nightly calibration writes each user's `calibration_state`.
```

---

## 10. Confidentiality & LLM Surface

The engine's internal architecture is confidential. The LLM never reveals: SCEFM, HIVE, Markov, motif, basin, petal, hexagram, brain, routing, KL, Laplace, EWMA, μ, σ, λ, exposure, resonance, support values, or any internal math. To users, HEX6 BLE is "a proprietary probability engine" — translated entirely into plain English.

Engine identity locked: **HEX6 BLE**, by Evrica Technologies Inc., created by Anna M. Sarkisyan and Blake Rice. Model version surfaced to users: **The Model · v5.5**.

---

## 11. Deferred — Future Work

- Feed walk-forward friction back as a next-bar exposure calibrator (currently a reported + saved diagnostic only).
- Brain merge / split / archival once empirical KL distributions accumulate (per v5.4 §14).
- Multi-asset walk-forward portfolio calibration (current baseline is single-asset directional).

---

**End of Spec v5.5.**