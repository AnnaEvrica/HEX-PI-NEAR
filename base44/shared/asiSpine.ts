// ASI Spine — tamper-evident provenance chain for verdicts.
//
// Shared by the `asiSpine` backend function and the `think` anchor hook so the
// hashing / chain logic lives in exactly one place (never duplicated across
// functions). Each verdict is anchored as one link in a hash-chain; the chain
// makes any later softening or alteration of a past verdict visible on verify.
//
// Validators run at anchor time. When any
// validator disagrees, disagreement_flag is set — that is the drift signal
// the referee / alerting layer subscribes to. Keeping the referee off the
// per-verdict path (only firing on flagged records) is what keeps LLM credit
// cost scaling with drift, not volume.

import { ENGINE_NAME } from './version.ts';

const GENESIS = 'GENESIS';

// Stable serialization: sort object keys at every depth so the content hash is
// deterministic regardless of key insertion order.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

function canonicalString(obj) {
  return JSON.stringify(sortKeys(obj));
}

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function contentHashOf(content) {
  return sha256Hex(canonicalString(content));
}

export async function computeChainHash(priorSpineHash, contentHash, timestamp) {
  return sha256Hex(`${priorSpineHash}:${contentHash}:${timestamp}`);
}

// Anchor a verdict to the spine. Uses asServiceRole so it works for any calling
// user. Never throws into the caller — returns null on failure so the chat
// path (which calls this fire-and-forget) is never blocked by spine errors.
export async function anchorVerdict(base44, input) {
  try {
    const {
      verdict_id,
      source_type = 'engine_output',
      content,
      validators = [],
      expert_echoes = [],
      authored_by = ENGINE_NAME,
    } = input;
    if (!verdict_id) return null;
    const SR = base44.asServiceRole.entities.VerdictSpine;

    // Latest record's chain_hash is the new prior. GENESIS if the spine is empty.
    let prior = GENESIS;
    try {
      const latest = await SR.list('-created_date', 1);
      if (latest && latest.length > 0 && latest[0].chain_hash) prior = latest[0].chain_hash;
    } catch {
      /* genesis */
    }

    const timestamp = new Date().toISOString();
    const content_hash = await contentHashOf(content);
    const chain_hash = await computeChainHash(prior, content_hash, timestamp);

    const disagrees = validators.filter((v) => v.agrees === false);
    const disagreement_flag = disagrees.length > 0;
    const disagreement_reason = disagrees.map((v) => `${v.id}: ${v.check}`).join(' | ');

    const record = await SR.create({
      verdict_id,
      source_type,
      content_hash,
      prior_spine_hash: prior,
      chain_hash,
      validators: JSON.stringify(validators),
      disagreement_flag,
      disagreement_reason,
      expert_echoes: JSON.stringify(expert_echoes),
      authored_by,
      anchored_at: timestamp,
    });
    return record;
  } catch (_e) {
    return null;
  }
}

// Verify the spine: walk the chain in creation order, confirm each link points
// to the previous chain_hash and each chain_hash recomputes from its stored
// content_hash + anchored_at. Collect every flagged disagreement. Broken links
// or recomputed-hash mismatches mean a past record was altered or inserted.
export async function verifyChain(base44) {
  const SR = base44.asServiceRole.entities.VerdictSpine;
  const rows = await SR.list('created_date', 5000); // ascending: walk in chain order
  let broken_at = null;
  const disagreements = [];
  const checked = [];
  let expectedPrior = GENESIS;

  for (const r of rows) {
    const linkOk = r.prior_spine_hash === expectedPrior;
    let hashOk = true;
    try {
      const recomputed = await computeChainHash(r.prior_spine_hash, r.content_hash, r.anchored_at);
      hashOk = recomputed === r.chain_hash;
    } catch {
      hashOk = false;
    }
    if (!linkOk || !hashOk) broken_at = broken_at ?? r.verdict_id;
    if (r.disagreement_flag) {
      disagreements.push({
        verdict_id: r.verdict_id,
        reason: r.disagreement_reason,
        anchored_at: r.anchored_at,
      });
    }
    checked.push({ verdict_id: r.verdict_id, linkOk, hashOk, disagreement_flag: r.disagreement_flag });
    expectedPrior = r.chain_hash;
  }

  return {
    chain_intact: broken_at === null,
    broken_at,
    disagreements,
    checked_count: checked.length,
  };
}