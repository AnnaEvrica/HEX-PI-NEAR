// The forward record: every direction read HEX gives on a ticker is logged,
// then scored against the first daily close after the call's horizon. This is
// a true out-of-sample record — nothing here is replayed or back-filled.
//
// It never touches the engine. It is recall, shown back to the model so it
// can speak honestly about its own record.

const DAY_MS = 24 * 60 * 60 * 1000;
const dirOf = (from: number, to: number) => (to > from ? 'UP' : to < from ? 'DOWN' : 'FLAT');

/** Finished daily bars only: a bar still in progress has no close to score against. */
export interface DailyBars { closes: number[]; timestamps: number[] }

/** The first daily close at or after `afterMs`, or null if no such bar exists yet. */
function closeAfter(bars: DailyBars | null, afterMs: number): number | null {
  if (!bars) return null;
  const n = Math.min(bars.timestamps.length, bars.closes.length);
  for (let i = 0; i < n; i++) {
    if (bars.timestamps[i] * 1000 >= afterMs) return bars.closes[i] ?? null;
  }
  return null;
}

/**
 * Score every open call in `rows` whose horizon has passed, against the first
 * daily close after that horizon (not against whatever the price is today).
 * Updates the rows in place and in the database. Returns how many were scored.
 * The chat function and the nightly job both score through here.
 */
export async function scoreDueCalls(entity, rows, bars: DailyBars | null, now = new Date()): Promise<number> {
  let scored = 0;
  for (const row of rows) {
    if (row.resolved || !row.resolve_after || new Date(row.resolve_after) > now) continue;
    const exit = closeAfter(bars, new Date(row.resolve_after).getTime());
    if (exit == null) continue; // the scoring bar has not printed yet
    const actual = dirOf(row.entry_price, exit);
    const patch = { resolved: true, exit_price: exit, actual_direction: actual, correct: actual === row.predicted_direction };
    try { await entity.update(row.id, patch); Object.assign(row, patch); scored++; } catch { /* non-blocking */ }
  }
  return scored;
}

export async function runPredictionJournal(base44, ticker: string, latestPrice: number, pipeline, askedBy: string, bars: DailyBars | null = null) {
  const entity = base44.asServiceRole.entities.PredictionJournal;
  const now = new Date();
  let rows = [];
  try { rows = await entity.filter({ ticker }, '-predicted_at', 40); } catch { return ''; }

  // 1. Score calls whose horizon has passed.
  await scoreDueCalls(entity, rows, bars, now);

  // 2. Log today's read — one open call per ticker at a time, and only when
  //    there is a read that departs from its usual odds (a read at its usual
  //    odds is not a call, so it is not scored as one).
  const open = rows.find((row) => !row.resolved);
  const read = pipeline?.read;
  if (!open && read && !read.direction_at_base) {
    try {
      await entity.create({
        ticker,
        predicted_direction: read.direction,
        // Distance of P(up) from the series' usual odds, in probability points.
        edge: Math.abs(read.edge_up),
        entry_price: latestPrice,
        predicted_at: now.toISOString(),
        resolve_after: new Date(now.getTime() + DAY_MS).toISOString(),
        resolved: false,
        asked_by: askedBy,
      });
    } catch { /* non-blocking */ }
  }

  // 3. Hand back the record.
  const scored = rows.filter((row) => row.resolved && typeof row.correct === 'boolean');
  if (!scored.length && !open) return '';
  const lines = [`YOUR FORWARD RECORD ON ${ticker} (direction reads logged live and scored on the next daily close):`];
  if (scored.length) {
    const hits = scored.filter((row) => row.correct).length;
    lines.push(`  ${hits} of ${scored.length} scored reads matched the next close`);
    if (scored.length < 30) lines.push('  this is too few to mean anything yet — if you mention it, say it is a short record');
  } else {
    lines.push('  nothing scored yet');
  }
  if (open) lines.push(`  one read is still open: ${open.predicted_direction} from $${Number(open.entry_price).toFixed(2)}, not yet scored`);
  lines.push('  Mention this only if they ask how you have done. Never present it as a track record or a performance claim.');
  return lines.join('\n');
}
