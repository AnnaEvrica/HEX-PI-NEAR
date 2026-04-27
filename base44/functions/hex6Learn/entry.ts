/**
 * hex6Learn — Self-learning accumulator for the HEX6 BLE engine.
 * Stores backtest results and trade outcomes so the engine can adapt over time.
 * Called after each backtest run and each auto-trade execution.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'recordBacktest') {
      // Store backtest outcome for learning
      const { ticker, params, metrics, engineParams } = body;
      await base44.asServiceRole.entities.HEX6Memory.create({
        memory_type: 'backtest',
        ticker,
        params: JSON.stringify(params || {}),
        metrics: JSON.stringify(metrics || {}),
        engine_params: JSON.stringify(engineParams || {}),
        sharpe: metrics?.sharpe ?? null,
        cagr: metrics?.cagr ?? null,
        max_drawdown: metrics?.maxDrawdown ?? null,
        recorded_by: user.email,
        notes: `Backtest: ${ticker} sharpe=${metrics?.sharpe?.toFixed(3) ?? '?'} cagr=${metrics?.cagr?.toFixed(1) ?? '?'}%`,
      });
      return Response.json({ ok: true, message: 'Backtest result stored for HEX6 learning.' });
    }

    if (action === 'recordTrade') {
      // Store trade outcome
      const { ticker, side, qty, price, engine, synthetic } = body;
      await base44.asServiceRole.entities.HEX6Memory.create({
        memory_type: 'trade',
        ticker,
        params: JSON.stringify({ side, qty, price, synthetic }),
        metrics: JSON.stringify({}),
        engine_params: JSON.stringify(engine || {}),
        sharpe: null,
        cagr: null,
        max_drawdown: null,
        recorded_by: user.email,
        notes: `Trade: ${side?.toUpperCase()} ${qty} ${ticker} @ $${price} | state=${engine?.marketState} conf=${engine?.confidence}`,
      });
      return Response.json({ ok: true, message: 'Trade recorded for HEX6 learning.' });
    }

    if (action === 'getSummary') {
      // Aggregate learned data to inform engine calibration
      const memories = await base44.asServiceRole.entities.HEX6Memory.list('-created_date', 200);

      const backtests = memories.filter(m => m.memory_type === 'backtest');
      const trades = memories.filter(m => m.memory_type === 'trade');

      // Compute average Sharpe across backtests
      const sharpes = backtests.filter(m => m.sharpe != null).map(m => m.sharpe);
      const avgSharpe = sharpes.length ? sharpes.reduce((a, b) => a + b, 0) / sharpes.length : null;

      // Best performing tickers by Sharpe
      const tickerSharpes = {};
      backtests.forEach(m => {
        if (m.ticker && m.sharpe != null) {
          if (!tickerSharpes[m.ticker]) tickerSharpes[m.ticker] = [];
          tickerSharpes[m.ticker].push(m.sharpe);
        }
      });
      const rankedTickers = Object.entries(tickerSharpes)
        .map(([ticker, vals]) => ({ ticker, avgSharpe: vals.reduce((a, b) => a + b, 0) / vals.length }))
        .sort((a, b) => b.avgSharpe - a.avgSharpe)
        .slice(0, 10);

      // Market state distribution from trades
      const stateCounts = {};
      trades.forEach(m => {
        try {
          const ep = JSON.parse(m.engine_params || '{}');
          const state = ep.marketState || 'UNKNOWN';
          stateCounts[state] = (stateCounts[state] || 0) + 1;
        } catch {}
      });

      return Response.json({
        totalMemories: memories.length,
        backtests: backtests.length,
        trades: trades.length,
        avgSharpe,
        topTickers: rankedTickers,
        marketStateDistribution: stateCounts,
        lastUpdated: memories[0]?.created_date || null,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});