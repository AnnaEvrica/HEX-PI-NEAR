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
| `hexadaptive.py` | Reference implementation of state-6.3 (HEX against the observer's baseline). `base44/shared/observer.ts` and `stateProbability.ts` must match it (`parity_adaptive.py`, `tests/parity.mjs`) |
| `loop_replay_adaptive.py` | The shipped loop replayed on 2016-2026: 6.2 and 6.3 daily, calibration from past calls, the promotion rule |

The data files (about 23 MB of public daily prices, Chicago temperatures and
race results) are not in the repository. They go in `validation/data/`.
