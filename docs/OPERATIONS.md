# Running HEX [PI] 7.0: infrastructure, cost and what to watch

For whoever runs and monitors the system. The mathematics is in
[`MODEL.md`](MODEL.md); this is the machinery around it.

## 1. What runs, and when

| Job | Trigger (Base44 workflow) | Function | What it does |
|---|---|---|---|
| Nightly update | `Nightly Cognition Calibration`, daily 10:00 UTC | `calibrateCognition` | The Learning Module's nightly calibration: score, learn and predict, commit, govern, then Experiential Integration into the Memory Library |
| Signal post | `HEX6-BLE Kalshi Signal (3x daily)` | `discordMorningSignal` | Reads the tracked list and posts to Discord |
| X engagement | `X Engagement — Crypto & Markets`, every 30 minutes | `xEngagement` | Replies and notes |
| Drift alert | `ASI Spine — drift alert`, on a flagged read | `spineAlert` | Discord alert |
| Chat | a user message | `think` | Reads a series when the message needs one; logs the call |
| On demand | a signed-in user | `walkForwardAccuracy` | The one-pass test on live data, with timings |

The nightly update is the only job that learns across series (strength maps,
which version is shown, which reads are verified). Everything else reads its
result through `loadLive` (`ledger.ts`).

## 2. State: what is stored and what is not

**The engine stores no state between runs.** Each time it is asked, it walks
the series from its first bar, one step at a time, and what it knows at the
end is what one pass through that history teaches it (`walkHex7`). This is a
deliberate choice:

- there is no checkpoint to corrupt, migrate or roll back;
- the deployed engine and the replay are the same computation, which is what
  lets `tests/parity.mjs` hold them to the same numbers;
- a code change takes effect for every series on the next run.

What *is* stored by the nightly update, in four entities:

| Entity | Rows | Written by | Purpose |
|---|---|---|---|
| `CallLedger` | one per series, read, version and day (4 per series per night), plus calls made in chat | `logCalls`, then `scoreOpenCalls` | Every call before its outcome, with what each part of memory said; then its score, reason and information gain |
| `EngineStatus` | one per read (2) | `calibrateCognition` | Version shown, verified flag, the running tally, both versions' strength maps, the precision metrics |
| `MomentMemory` | one per series per finished bar | stage 5 (`memory.ts`) | The Memory Library: each moment as perceived, with its individuality, affinity and transition. Appended, never changed. Read by nothing but stage 5 |
| `NightlyCalibration` | one per night | stage 5 | The night's summary and its references. Appended, never changed |

`EngineStatus.tally` holds running sums over every settled day, so each
night's decision uses the whole record without rereading the ledger.

Fourteen entities that no code used were removed on 9 October 2026
(`CHANGELOG.md`). Every entity now in `base44/entities/` is used.

## 3. Cost and how it scales

Measured on a two-core cloud container, Node 22, both versions and both
reads, series of 2,700 to 3,900 daily bars:

| Operation | Cost |
|---|---|
| One engine run for one series (`runEngines`: 7.0 and 6.5, both reads) | 150 to 280 ms, mean 170 ms |
| of which 7.0 alone | roughly half |
| One nightly update, 7 tracked series | about 1.5 s of engine time, plus seven market-data fetches |
| One nightly update at the cap of 27 series | about 6 s of engine time |
| One chat read of a ticker | one engine run |

- **Time is linear in the length of a series and in the number of series.**
  The history pulled per series is capped at 5,475 days
  (`universe.ts: HISTORY_DAYS`).
- **Memory** is small: 7.0 holds eighteen 14×14 matrices and a sorted copy of
  the series per read.
- **Ledger growth.** A row is about 1.5 kB (the views are the bulk: about
  0.5 kB for a 7.0 row, 1.3 kB for a 6.5 row). Four rows per series per night:

  | Tracked series | Rows per night | Per year |
  |---|---|---|
  | 7 | 28 | about 15 MB |
  | 27 (the cap) | 108 | about 60 MB |

- **The cap on tracked series** is `UNIVERSE` (7) plus `MAX_EXTRA_SERIES`
  (20) tickers that people asked about in chat.

If engine time ever matters (many more series, or intraday bars), the walk
can be made incremental by persisting each series' state after its last bar
and resuming from it. The state is small (section 2 of the cost list). That
would trade the "no stored state" property for speed, and would need its own
parity test against the full walk. Nothing today requires it.

## 4. What to watch

`calibrateCognition` returns, every night:

```
{ ok, engine_version, series, failed: [...], newly_scored, newly_logged,
  elapsed_ms, per_series_ms: { BTC: 310, ... },
  status: { MOVE: {...}, RANGE: {...} },
  experiential: { ok, run_id, recorded, moments, without_a_moment: [...],
                  no_new_bar: [...], integrity: { checked, series, reproduced },
                  elapsed_ms } }
```

| Watch | Healthy | If not |
|---|---|---|
| `ok` | `true` | The job threw; the error is in the response and the function log |
| `failed` | empty | A ticker's market data could not be fetched; it is skipped tonight and scored when it returns |
| `newly_logged` | 4 × series tracked | Fewer means some series were already logged today (a rerun) or failed |
| `newly_scored` | about 4 × series, one bar behind | Zero for several nights on a trading series means bars are not arriving |
| `elapsed_ms`, `per_series_ms` | seconds | Growth here is the scaling signal |
| `status.*.live_engine`, `decision` | `hex-7.0`, `hold` | `demote` means 6.5 is clearly ahead of 7.0 on the live record: read `reason` |
| `status.*.verified` | RANGE `true`, MOVE `false` at release | A change means the live record became decisive: read the bits and interval |
| `status.*.bits_candidate`, `_low`, `_high` | positive for RANGE over time | The live measure of whether the edge is alive |
| `status.*.hit_candidate` beside `hit_baseline` | at or above | Share right against what the null alone gets |
| `experiential.ok` | `true` | Stage 5 threw. Stages 1 to 4 had already completed and are unaffected; the error is in `experiential.error`. Run the job again the same day: moments already written are not written twice |
| `experiential.recorded` | `true` once a day | `false` means this date already has its row: a rerun, nothing written |
| `experiential.moments` | the series that had a new bar | A series with a history too short to perceive, or a bad bar, is in `without_a_moment`; one whose last bar was already recorded (stocks at a weekend) is in `no_new_bar` |
| `experiential.integrity.reproduced` | `true` | `false` means a moment perceived twice from the same bars gave two different hashes: stop and investigate before trusting the night's row |
| `experiential.elapsed_ms` | about 1 s at 7 series, 2.5 s at 27 | Growth here means the library read is growing, which it should not |

The same numbers are in the two `EngineStatus` rows at any time, with
`stated_*` (to set beside the share right), `closeness_*`, `progress_*`,
`lesson_*`, and `reasons_*` (misses counted by reason).

Two limits to know:

- The nightly update reads the 5,000 most recently scored rows. At the cap
  of 27 series that is 46 nights. If the job is down for longer than that,
  the days in between are not added to the tally (they are never double
  counted). The ledger rows themselves are still there.
- A day enters the tally five days after its calls (`SETTLE_DAYS`), so that
  its scoring is complete.

## 5. Before pressing Publish on Base44

0. For the Learning Module's stage 5 (branch `learning-module`): the two new
   entities `MomentMemory` and `NightlyCalibration` exist with the fields in
   `base44/entities/`. Nothing needs migrating; the library starts empty and
   the first night records each series' first moment with no individuality
   and no transition.
1. `CallLedger` and `EngineStatus` exist with the fields in
   `base44/entities/`. New or renamed in 7.0:
   - `CallLedger`: `log_score`, `info_gain`, `learned`, `part_structure`
     (replaces `part_state`); `engine` is now `state-6.5` or `hex-7.0`.
   - `EngineStatus`: `verified`, `bits_candidate`, `bits_candidate_low`,
     `bits_candidate_high`, `bits_control`, `bits_control_low`,
     `bits_control_high`, `closeness_candidate`, `closeness_control`,
     `calibration_control`, `tally`; `live_engine` is now `state-6.5` or
     `hex-7.0`.
2. The `Nightly Cognition Calibration` workflow is active.
3. Run `calibrateCognition` once by hand and read its response against the
   table in section 4.
4. Sign-in still works (the builder simplified authentication in an earlier
   change).

Nothing in the ledger needs migrating: no earlier version has run live.

## 6. Reproducing the measurements

See [`../validation/README.md`](../validation/README.md). In short:

```
python3 validation/replay.py            # the one-pass replay: ledger, snapshots, final state
python3 validation/replay_report.py     # every number and chart from the ledger
node tests/parity.mjs                   # product code against the reference
```

`validation/replay/hex7_ledger.parquet` is every call of the replay, in
order, with the probabilities of the null, 7.0, 6.5 and the frozen copy, the
outcome, and hashes of the engine state, the code and the data seen so far.
`hex7_state_snapshots.parquet` holds the learned coefficients every 25th
call. `hex7_checkpoint_2026_09_30.json` is the final state of every series.
Because the engine stores no state, that last file is a record for audit,
not something the product loads: the product reaches the same state by
walking each series itself.
