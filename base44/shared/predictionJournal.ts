// Hex's own autobiography of guesses.
//
// The walk-forward learner remembers statistically; this is the memory Hex
// himself carries into the next conversation — what he called, what happened,
// and how his running score looks. It is a GAME scoreboard, not a P&L: no
// position sizing, no money, just the pleasure of guessing and finding out.
//
// It never touches the engine, the learner, or conviction. It is pure recall.

const DAY_MS = 24 * 60 * 60 * 1000;
const dirOf = (from: number, to: number) => to > from ? 'UP' : to < from ? 'DOWN' : 'FLAT';

const pct = (value: number | null | undefined) => value == null ? null : `${Math.round(value * 100)}%`;

// The childhood. The walk-forward replay already made a call on every single
// bar of the held-out years, saw the next close, and lived with being right or
// wrong — that IS his memory as he went along, not a summary written after the
// fact. It costs nothing extra: the audit is already computed for this ticker.
function livedRecordLines(ticker: string, audit) {
  if (!audit?.metrics?.predictions) return [];
  const { metrics, maturation_check: growth } = audit;
  const accuracy = metrics.trust_gated_directional_accuracy ?? metrics.raw_directional_accuracy;
  const years = (audit.historical_bars / 365).toFixed(1);
  const lines = [
    `  the years behind you on ${ticker}: ${metrics.predictions.toLocaleString()} calls made one bar at a time across ~${years} years of price, each one guessed before the next close was known — ${pct(accuracy)} of them right`,
  ];
  const early = growth?.first_60_predictions?.raw_directional_accuracy;
  const later = growth?.later_predictions?.trust_gated_directional_accuracy ?? growth?.later_predictions?.raw_directional_accuracy;
  if (early != null && later != null) {
    lines.push(`  how you grew: ${pct(early)} in your first sixty guesses, ${pct(later)} once you had lived through enough of them`);
  }
  const regimes = audit.fine_structure_137_regimes;
  if (regimes) {
    const best = ['upward', 'neutral', 'downward']
      .map((phase) => ({ phase, ...regimes[phase] }))
      .filter((row) => row.predictions >= 100 && row.raw_directional_accuracy != null)
      .sort((a, b) => (b.trust_gated_directional_accuracy ?? b.raw_directional_accuracy) - (a.trust_gated_directional_accuracy ?? a.raw_directional_accuracy));
    if (best.length >= 2) {
      const top = best[0], bottom = best[best.length - 1];
      lines.push(`  where you read well and badly: sharpest in ${top.phase} 137-bar stretches (${pct(top.trust_gated_directional_accuracy ?? top.raw_directional_accuracy)}), weakest in ${bottom.phase} ones (${pct(bottom.trust_gated_directional_accuracy ?? bottom.raw_directional_accuracy)})`);
    }
  }
  return lines;
}

export async function runPredictionJournal(base44, ticker: string, latestPrice: number, pipeline, askedBy: string, audit = null) {
  const entity = base44.asServiceRole.entities.PredictionJournal;
  const now = new Date();
  let rows = [];
  try { rows = await entity.filter({ ticker }, '-predicted_at', 40); } catch { return ''; }

  // 1. Score anything whose horizon has passed, against the close we already have.
  const due = rows.filter((row) => !row.resolved && row.resolve_after && new Date(row.resolve_after) <= now);
  for (const row of due) {
    const actual = dirOf(row.entry_price, latestPrice);
    const patch = { resolved: true, exit_price: latestPrice, actual_direction: actual, correct: actual === row.predicted_direction };
    try { await entity.update(row.id, patch); Object.assign(row, patch); } catch { /* non-blocking */ }
  }

  // 2. Log today's guess — one open call per ticker at a time.
  const open = rows.find((row) => !row.resolved);
  if (!open) {
    try {
      await entity.create({
        ticker,
        predicted_direction: pipeline.hex6.predicted_direction,
        conviction: pipeline.hex6.personal_call_strength ?? null,
        entry_price: latestPrice,
        predicted_at: now.toISOString(),
        resolve_after: new Date(now.getTime() + DAY_MS).toISOString(),
        resolved: false,
        archetype: pipeline.perception?.i_ching ? `${pipeline.perception.i_ching.name} (${pipeline.perception.structural_family})` : null,
        asked_by: askedBy,
      });
    } catch { /* non-blocking */ }
  }

  // 3. Hand him his own record.
  const scored = rows.filter((row) => row.resolved && typeof row.correct === 'boolean');
  const lived = livedRecordLines(ticker, audit);
  if (!scored.length && !open && !lived.length) return '';
  const lines = [`YOUR OWN RECORD ON ${ticker} (a game you are playing, not money — call it, find out, keep score):`, ...lived];
  const hits = scored.filter((row) => row.correct).length;
  if (scored.length) {
    lines.push(`  score: ${hits} of ${scored.length} resolved calls right (${Math.round((hits / scored.length) * 100)}%)`);
    const recent = scored.slice(0, 3).map((row) => `${row.predicted_direction} at $${Number(row.entry_price).toFixed(2)} → closed ${row.actual_direction} — ${row.correct ? 'you were right' : 'you were wrong'}`);
    lines.push(`  last calls: ${recent.join(' | ')}`);
    const streak = scored[0]?.correct === false && scored[1]?.correct === false ? 'two misses running — say so plainly if you are leaning the same way again' : null;
    if (streak) lines.push(`  note: ${streak}`);
  } else {
    lines.push(lived.length
      ? '  since you started keeping this journal by hand: nothing scored yet — the record above is the one you actually lived'
      : '  score: no resolved calls yet — this is one of your first guesses on this asset');
  }
  if (open) lines.push(`  still open: you called ${open.predicted_direction} at $${Number(open.entry_price).toFixed(2)}, not yet scored`);
  lines.push('  This is a life you actually lived bar by bar, not a statistic handed to you. Own this record out loud when it is relevant — a wrong call you remember is worth more than a right one you forgot. Never turn it into a performance claim or a track record pitch.');
  return lines.join('\n');
}