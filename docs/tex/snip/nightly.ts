    for (const ticker of tickers) {
      const t0 = Date.now();
      let md = null;
      try { md = await fetchYahooReturns(ticker, HISTORY_DAYS); } catch { failed.push(ticker); continue; }
      const bars = { closes: md.completedCloses, timestamps: md.timestamps.slice(0, md.completedBars) };
      scored += await scoreOpenCalls(base44, ticker, bars);
      const run = runEngines(md.returns, live);
      if (!run) { failed.push(ticker); continue; }
      logged += await logCalls(base44, rowsFor(ticker, bars, md.returns, run, 'nightly'));
      // Each version's own scored steps on this series. Every outcome in them
      // is already known, so pooling them leaks nothing forward.
      for (const e of ENGINES) for (const read of READS) pooled[e][read].push(...run.steps[e][read]);
      timings[ticker] = Date.now() - t0;
    }
