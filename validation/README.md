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
