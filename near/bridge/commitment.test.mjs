// node --test near/bridge
import test from 'node:test';
import assert from 'node:assert/strict';
import { callId, canonical, callOf, commitmentOf, revealOf, verifyEntry, hashOf, outcomeAfterNs } from './commitment.mjs';

const SECRET = 'test-secret-test-secret-test-secret-0001';
const row = {
  series_id: 'CHI-TEMP', read: 'MOVE', engine: 'hex7', call_date: '2026-11-10', bar_ts: 1_762_732_800,
  last_close: 8.4, threshold: null, baseline: 0.507, probability: 0.629, raw: 0.631,
  views: '{"baseline":0.507,"raw":0.631}', made_at: '2026-11-11T02:00:00.000Z', engine_version: '7.0',
  shown: true, source: 'nightly', deployment: 'test',
};

test('the id is the ledger key', () => {
  assert.equal(callId(row), 'CHI-TEMP|MOVE|hex7|2026-11-10');
});

test('canonical JSON ignores key order', () => {
  assert.equal(canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), canonical({ a: [2, { c: 4, d: 3 }], b: 1 }));
  assert.equal(canonical({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('only pre-outcome fields are committed', () => {
  const scored = { ...row, scored: true, outcome: 1, info_gain: 0.05 };
  assert.equal(callOf(scored), callOf(row));
  assert.ok(!callOf(row).includes('shown') && !callOf(row).includes('deployment'));
});

test('the outcome time is two days after the call bar opens', () => {
  assert.equal(outcomeAfterNs(row), (1_762_732_800n + 172_800n) * 1_000_000_000n);
});

test('a reveal reproduces its commitment', () => {
  const c = commitmentOf(row, SECRET);
  const r = revealOf({ ...row, scored: true, outcome: 1, info_gain: 0.05 }, SECRET);
  assert.equal(r.id, c.id);
  assert.equal(hashOf(r.salt, r.call), c.hash);
});

test('a changed probability does not reproduce the commitment', () => {
  const c = commitmentOf(row, SECRET);
  const r = revealOf({ ...row, probability: 0.729, scored: true, outcome: 1 }, SECRET);
  assert.notEqual(hashOf(r.salt, r.call), c.hash);
});

test('an unscored call cannot be revealed', () => {
  assert.throws(() => revealOf(row, SECRET), /not scored/);
});

test('a short secret is refused', () => {
  assert.throws(() => commitmentOf(row, 'short'), /LEDGER_SALT_SECRET/);
});

test('verifyEntry reports verified, pending and mismatch', () => {
  const c = commitmentOf(row, SECRET);
  const r = revealOf({ ...row, scored: true, outcome: 1 }, SECRET);
  const base = { hash: c.hash, outcome_after: c.outcome_after, committed_at: '1762800000000000000' };
  assert.equal(verifyEntry({ id: c.id, commitment: { ...base, reveal: null } }).status, 'pending');
  assert.equal(verifyEntry({ id: c.id, commitment: { ...base, reveal: r } }).status, 'verified');
  assert.equal(verifyEntry({ id: c.id, commitment: { ...base, reveal: { ...r, call: r.call.replace('0.629', '0.729') } } }).status, 'mismatch');
});

// The same preimage the Rust tests use, so both sides are held to one format.
// near/contract/src/tests.rs pins the same vector (hash_vector_matches_the_bridge).
test('hash format matches the contract', () => {
  assert.equal(
    hashOf('4f2a9c', '{"engine":"hex7","probability":0.61,"read":"MOVE","series_id":"CHI-TEMP"}'),
    '3d619ffa053c255cb924b2be09a10366b142d99001815e7321d1388794ad15c6',
  );
});
