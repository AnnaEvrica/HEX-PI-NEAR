# Validation

The experiments behind every accuracy figure. Each has its predictions written
before the run (`prereg_*.md`) and its results beside it (`*_results.json`).

| Script | What it tests |
|---|---|
| `field.py`, `pretrain.py`, `pretrain_standard.py`, `precision.py` | The 6.2 engine: skill, cold start, hit rates |
| `core.py`, `core2.py` (frozen in `checkpoints/core2/`) | First-order structure; the level-rank baseline that explained the racing result |
| `core3.py`, `core3_ablate.py`, `core3_ablate2.py`, `core3b.py`, `core3_drift.py` | The rank core against a rank-conditioned null; where 6.2's lead lived |
| `rankcore.py`, `core4.py`, `core4b.py`, `loop_replay.py` | The rank model as a caller of its own: a benchmark, not shipped. Its baseline (`null`) is the observer |
| `core5.py` | HEX as the only caller with the rank model observing: which form of observation helps |
| `hexadaptive.py`, `loop_replay_adaptive.py` | HEX 6.2's formula against the observer's baseline (the intermediate 6.3) |
| `hexmodel.py` | Reference implementation of state-6.4: HEX as an explicit model. `base44/shared/hex.ts` must match it (`parity_hex.py`, `tests/parity.mjs`). The mathematics is in `docs/MODEL.md` |
| `core6.py` | 6.4 against 6.2 and 6.3 on every domain and read; cold start |
| `core7.py` | Three richer castings of the six lines as hypotheses: four-valued lines with a derived second pattern, separate sharing for the older and newer three lines, and pairing each pattern with its reversal. None added predictive information |
| `spectral.py`, `core8.py` | The exact posterior under the cube's diffusion prior, in the Walsh basis; how much of the fitted effect involves one line, two lines, and so on |
| `loop_replay_hex.py` | The shipped loop replayed on 2016-2026 with 6.4 |

The data files (about 23 MB of public daily prices, Chicago temperatures and
race results) are not in the repository. They go in `validation/data/`.
