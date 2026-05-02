// One-shot migration: convert existing MarkovTickerMemory records into seed Brains.
// Each ticker becomes one Brain with brain_id = "seed_<TICKER>".
// Admin-only. Idempotent — safe to re-run; existing seed brains are skipped.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const tickerMemories = await base44.asServiceRole.entities.MarkovTickerMemory.list('-total_observations', 500);
    if (!tickerMemories || tickerMemories.length === 0) {
      return Response.json({ migrated: 0, message: 'No ticker memories to migrate.' });
    }

    const existingBrains = await base44.asServiceRole.entities.Brain.list('', 500).catch(() => []);
    const existingIds = new Set((existingBrains || []).map(b => b.brain_id));

    let migrated = 0;
    let skipped = 0;
    const created = [];

    for (const tm of tickerMemories) {
      const brainId = `seed_${tm.ticker}`;
      if (existingIds.has(brainId)) {
        skipped += 1;
        continue;
      }

      const totalCount = tm.total_observations || 0;
      const newBrain = {
        brain_id: brainId,
        transition_matrix: tm.transition_matrix || '{}',
        transition_rewards: tm.transition_rewards || '{}',
        count: totalCount,
        series_count: 1, // each ticker memory came from at least one series
        confidence: Math.min(1, totalCount / 30),
        last_updated: tm.last_updated || new Date().toISOString(),
      };
      await base44.asServiceRole.entities.Brain.create(newBrain);
      created.push(brainId);
      migrated += 1;
    }

    return Response.json({
      migrated,
      skipped,
      total_ticker_memories: tickerMemories.length,
      brains_created: created,
    });
  } catch (error) {
    console.error('migrateBrains error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});