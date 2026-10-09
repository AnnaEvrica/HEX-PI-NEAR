# Validation

Everything behind the figures in the README and `docs/MODEL.md`. Each
experiment has its predictions written before the run (`prereg_*.md`) and its
results beside it.

## HEX 7.0

| File | What it is |
|---|---|
| `hex7core.py` | Reference implementation of 7.0. `base44/shared/hex7.ts` must match it to rounding (`parity_hex7.py` writes the reference, `tests/parity.mjs` checks it) |
| `prereg_replay.md` | The frozen specification, the data rules and the predictions, written before the replay; and one amendment made after the first run |
| `replay.py` | The one-pass replay: reveal, score, learn, predict, commit, for every series from its first value |
| `replay_report.py` | Every number and chart, computed from the ledger |
| `replay/hex7_ledger.parquet` | Every call of the replay, in order: 280,252 rows. Probabilities of the null, 7.0, 6.5, the frozen copy and the two models; outcome; experience count; hashes of the engine state, of the code, and of the data seen so far |
| `replay/hex7_state_snapshots.parquet` | The learned coefficients and influences every 25th call of every series |
| `replay/hex7_checkpoint_2026_09_30.json` | The final state of every series |
| `replay/report.json`, `replay/chart_*.png` | The results |
| `replay/replay_meta.json` | Row counts, the one-pass check, which currencies the inclusion rule kept |
| `timesim/calls.mjs`, `timesim/cycle.mjs` | The same ten years run with the product's own code and the product's ledger functions (database in memory) |
| `timesim/product_run.json`, `product_run_part1.log` | Its results |
| `hex7.py`, `prereg_hex7.md`, `hex7_results_*.json` | The first test of the proposal: which parts of it added information (interactions, call-changing calibration and the interference model did not) |

### Three checks that the numbers mean what they say

1. **No call saw its own future.** `replay.py` reruns the engine on truncated
   histories at 258 sampled points and compares with the ledger: largest
   difference 0.
2. **The product code is the tested code.** `tests/parity.mjs`: on identical
   inputs the TypeScript engines and the Python references agree to 10⁻¹³.
3. **The product's nightly path gives the same calls.** `timesim/calls.mjs`
   runs the nightly entry point (`runEngines`) on only what was known on 680
   sampled nights: 2,720 calls, none different. And the product run's 92,888
   calls on the 17 market series, computed from prices independently of the
   reference, match the reference replay's to 10⁻¹⁴, for 7.0 and for 6.5.

### Running it

```
pip install numpy pandas scikit-learn pyarrow matplotlib
python3 replay.py             # about 4 minutes
python3 replay_report.py      # about 2 minutes
python3 parity_hex7.py        # rewrites tests/../parity_hex7_reference.json (copy it into tests/)
python3 timesim/export_series.py <dir>                       # one CSV per market series
node timesim/calls.mjs <dir> <out>                           # one pass with the product code, about 1 minute
TIMESIM_DATA=<dir> node timesim/cycle.mjs <out> result.json  # the cycle through time, about 6 minutes
```

### Data

Not in the repository. All of it is public.

- `data/`: daily closes for bitcoin, oil (WTI, Brent), natural gas, the VIX
  and daily exchange rates; Chicago daily temperatures; race results. About
  23 MB.
- `data_replication/` (series never used before 7.0's replay):
  - `daily-max-temperatures.csv` — Melbourne 1981–1990, from
    `github.com/jbrownlee/Datasets`
  - `2016-weather-data-seattle.csv` — Seattle 1948–2015, from
    `github.com/plotly/datasets`
  - `weather.csv` — New York 2012–2015, from `github.com/vega/vega-datasets`
  - the ten currencies come from the exchange-rate file already in `data/`:
    every country other than the twelve used before.

## CER (Cross-Environment Resonance), in shadow beside 7.0

A separate experimental module that reads across series. It changes nothing
in HEX and no call shown to a user. Mathematics and interface: `docs/CER.md`.

| File | What it is |
|---|---|
| `prereg_cer.md` | The frozen specification, controls and predictions of all four experiments, each written before its run |
| `cer_results.md` | What came out, prediction by prediction |
| `cercore.py` | Reference implementation. `base44/shared/cer/*.ts` must match it to rounding (`tests/cer.mjs`) |
| `cer_synthetic.py` | Twelve tests on signals whose relationships are built in; writes `tests/cer_reference.json` |
| `cer_replay.py` | The one-pass replay with CER beside every call of 7.0: standalone and fusion candidate, same-date and strict, real record and three records displaced in time, and all three ways of hearing an edge (past success, measured weight, maximum entropy) from the same experts in the same pass |
| `cer_report.py` | Every number and chart, computed from the ledger |
| `cer_perception.py` | Eight tests of perception on built configurations, kept apart from forecasting; writes `cer/perception.json` |
| `cer_diagnostic.py` | After the run: what the displaced temperature neighbours carry (the calendar) |
| `cer/cer_ledger.parquet` | Every call: 303,722 rows. The null, 7.0, and CER's four arms on the real record under every mode (`cer_*` by past success; `d_cerm_*` the moment, `d_cerq_*`, `d_cere_*`, `d_cert_*` the frozen comparators, as departures from their offset), and novelty at every call |
| `cer/cer_controls.parquet` | The controls, as sums over 20-day blocks |
| `cer/frozen_manifest.json` | What was frozen at `cer-0.3` before the moment-centric refactor: commit, source hashes, data checksums, outputs |
| `cer/cer_moment_*.json`, `cer/cer_moment_edges.json` | The signature of the last moment each target met; mean evidence and eligibility of every interpretation |
| `cer/cer_edges.json` | Every edge's own expert scored alone, its share of the call, and its measured A, L, C, Q and weight |
| `cer/cer_graph_*.json` | The descriptive graph of each universe on its last day |
| `cer/report.json`, `cer/chart_*.png`, `cer/cer_meta.json` | The results, and the no-future check |

```
python3 cer_synthetic.py && node ../tests/cer.mjs
python3 cer_perception.py
python3 cer_replay.py         # about 25 minutes on two cores; CER_FROZEN=all also recomputes the three frozen comparators (70 minutes)
python3 cer_diagnostic.py
python3 cer_report.py
```

Bitcoin: copy `tests/backend-smoke/BTC_daily.csv` to `data/BTC_daily.csv`.
With it and the sources listed below, all 43 series reproduce the committed
7.0 ledger exactly. Chicago temperature:
`github.com/zonination/weather-us`; racing:
`github.com/constancedongg/Horse-Racing`.

## The Learning Module: Experiential Integration and the Memory Library

Stage 5 of the nightly calibration. Mathematics: `docs/LEARNING.md`.

| File | What it is |
|---|---|
| `prereg_experience.md` | Names, specification and predictions E1 to E12, written before any run; the amendments made before the run on real series; the correction made after it |
| `experience_results.md` | What came out, prediction by prediction |
| `experience.py` | Reference implementation. `base44/shared/experience.ts` must match it to rounding (`tests/experience.mjs`) |
| `experience_tests.py` | Eight tests on built signals (E1 to E8); writes `tests/experience_reference.json` and `experience/built_signals.json` |
| `experience_replay.mjs` | The nightly stage itself (`base44/shared/memory.ts`) run night by night over 400 nights of the 27 market series on an in-memory database; `SURROGATE=11` runs the control with the days in a random order |
| `experience_check.py` | Sampled real moments from that run, perceived again by the reference |
| `experience/nightly.json` | Every nightly record of the run: real computed values |
| `experience/moments.csv` | Every moment of the run, without its signature |
| `experience/moment_samples.json` | Three whole `MomentMemory` rows |
| `experience/real_series.json`, `experience/control_shuffled_days_11.json` | What E12 is judged on, and the same numbers for the control |

```
python3 experience_tests.py && node ../tests/backend-smoke/build.mjs && node ../tests/experience.mjs
node experience_replay.mjs && SURROGATE=11 node experience_replay.mjs     # about 20 minutes each
python3 experience_check.py
```

`experience_replay.mjs` reads `data/markets_channels.json`: the 27 market
series of `cer_replay.py` (`series_list`), as days and log changes.

## Earlier engines

| Script | What it tests |
|---|---|
| `field.py`, `precision.py` | The 6.2 engine (retired): skill, cold start, hit rates |
| `core.py`, `core2.py` (frozen in `checkpoints/core2/`) | First-order structure; the level-rank baseline that explained the racing result |
| `core3*.py` | The rank core against a rank-conditioned null |
| `rankcore.py`, `core4.py`, `core4b.py`, `loop_replay.py` | The first rank model. Its null is the observer. 7.0 grew out of this |
| `core5.py` | Which form of observation helps |
| `hexadaptive.py`, `loop_replay_adaptive.py` | The intermediate 6.3 |
| `hexmodel.py`, `core6.py` | 6.4: the six-line state engine as an explicit model |
| `core7.py`, `spectral.py`, `core8.py`, `core9.py` | Richer state patterns, the exact posterior in the Walsh basis, and quantum-walk kernels. None added information |
| `core10.py`, `core10b.py`, `hexcoupled.py` | Coupling the two reads: 6.5. `base44/shared/hex.ts` must match `hexcoupled.py` |
| `loop_sim.py`, `loop_sim_side.py`, `progress_sim.py` | The loop from a cold start; why calibration is confined to strength; reward as progress |
