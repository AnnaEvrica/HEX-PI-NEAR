// asiSpine — admin-only governance endpoint for the ASI provenance spine.
// Actions:
//   anchor  — append a verdict (with validators + expert echoes) to the chain.
//   verify  — walk the chain, report broken links + every flagged disagreement.
//   latest  — return the current chain head (the most recent chain_hash).
//
// The hot chat path does NOT call this function; it calls anchorVerdict()
// from the shared module directly (fire-and-forget) to avoid per-verdict
// HTTP overhead. This endpoint exists for manual/admin anchoring and for the
// verify/latest operations the drift dashboard will use.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { anchorVerdict, verifyChain } from '../../shared/asiSpine.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { action } = body;

    if (action === 'anchor') {
      const record = await anchorVerdict(base44, body.input || {});
      if (!record) return Response.json({ error: 'Anchor failed' }, { status: 500 });
      return Response.json({ data: record });
    }

    if (action === 'verify') {
      const result = await verifyChain(base44);
      return Response.json({ data: result });
    }

    if (action === 'latest') {
      const latest = await base44.asServiceRole.entities.VerdictSpine.list('-created_date', 1);
      return Response.json({ data: latest && latest.length > 0 ? latest[0] : null });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}