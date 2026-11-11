// HEX [PI] ledger rows -> NEAR commitments.
//
// A commitment is sha256(salt + ":" + call), where `call` is the canonical
// JSON of the fields fixed when the call is written, and `salt` is
// HMAC-SHA256(LEDGER_SALT_SECRET, id). The salt hides the call until reveal
// (a direction call could otherwise be guessed from two possible hashes) and
// needs no storage: it is re-derived from the secret at reveal time.
//
// The contract checks the same preimage format; see near/contract/src/lib.rs.

import { createHash, createHmac } from 'node:crypto';

const DAY_S = 86_400;

/** The fields of a ledger row that are fixed before its outcome exists. */
export const CALL_FIELDS = [
  'series_id', 'read', 'engine', 'call_date', 'bar_ts', 'last_close', 'threshold',
  'baseline', 'probability', 'raw', 'views', 'learned', 'made_at', 'engine_version',
];

/** One call per series, read, engine and day: the same key the ledger uses. */
export function callId(row) {
  for (const k of ['series_id', 'read', 'engine', 'call_date']) {
    if (row[k] === undefined || row[k] === null || row[k] === '') throw new Error(`ledger row is missing ${k}`);
  }
  return `${row.series_id}|${row.read}|${row.engine}|${row.call_date}`;
}

/** JSON with keys sorted at every level and no whitespace, so the same call always hashes the same. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number in call');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

/** The call as committed: only the pre-outcome fields, present ones only. */
export function callOf(row) {
  const call = {};
  for (const k of CALL_FIELDS) if (row[k] !== undefined && row[k] !== null) call[k] = row[k];
  return canonical(call);
}

export function saltFor(id, secret) {
  if (!secret || secret.length < 32) throw new Error('LEDGER_SALT_SECRET must be set and at least 32 characters');
  return createHmac('sha256', secret).update(id).digest('hex');
}

export function hashOf(salt, call) {
  return createHash('sha256').update(`${salt}:${call}`).digest('hex');
}

/**
 * The earliest moment the outcome can exist, in nanoseconds.
 *
 * A row's bar_ts is the opening time of the bar the call was made on (Yahoo
 * daily bars), in seconds, and the call is scored on the close of the next
 * bar. That close cannot come before the next bar's own day has ended:
 * bar_ts + 2 days. For a market that closes before midnight UTC this is later
 * than the true close, which only delays the reveal; it never lets a commit
 * through after the outcome exists.
 */
export function outcomeAfterNs(row) {
  if (!Number.isFinite(row.bar_ts) || row.bar_ts <= 0) throw new Error('ledger row has no bar_ts');
  return (BigInt(Math.trunc(row.bar_ts)) + BigInt(2 * DAY_S)) * 1_000_000_000n;
}

/** What `commit_batch` takes for one row. */
export function commitmentOf(row, secret) {
  const id = callId(row);
  const call = callOf(row);
  return { id, hash: hashOf(saltFor(id, secret), call), outcome_after: outcomeAfterNs(row).toString() };
}

/** What `reveal_batch` takes for one scored row. */
export function revealOf(row, secret) {
  if (!row.scored || row.outcome === undefined) throw new Error(`call ${callId(row)} is not scored yet`);
  const id = callId(row);
  const outcome = canonical({ outcome: row.outcome, info_gain: row.info_gain ?? null, log_score: row.log_score ?? null, scored_at: row.scored_at ?? null });
  return { id, call: callOf(row), salt: saltFor(id, secret), outcome };
}

/** Anyone's check of a revealed entry from the contract: does the revealed call hash to the commitment? */
export function verifyEntry(entry) {
  const c = entry.commitment;
  if (!c.reveal) return { id: entry.id, status: 'pending' };
  const ok = hashOf(c.reveal.salt, c.reveal.call) === c.hash;
  const before = BigInt(c.committed_at) < BigInt(c.outcome_after);
  return { id: entry.id, status: ok && before ? 'verified' : 'mismatch', committed_before_outcome: before, hash_matches: ok };
}
