/**
 * hex6Engine.js
 *
 * Convenience wrappers for Dashboard.jsx / AssetDetail.jsx.
 * The canonical HEX6 BLE v5.0 engine lives in hex6Engine.ts.
 */

import { calculateTargetAllocation } from './hex6Engine.ts';
import { mintEgtsAssetFromPie } from './egtsService';
import { base44 } from '@/api/base44Client';

export { calculateTargetAllocation } from './hex6Engine.ts';
export { Hex6BLEEngine } from './hex6Engine.ts';

export const MARKET_STATES = {
  BULL: 'BULL',
  BEAR: 'BEAR',
  LATERAL: 'LATERAL',
  VOLATILE: 'VOLATILE',
  SILENCE: 'SILENCE',
};

/**
 * onRebalance — triggers the full HEX6 BLE v5.0 SCEFM engine with real market data.
 * Falls back to synthetic data if market data fetch fails for a ticker.
 */
export async function onRebalance({ assets, triggeredBy = 'HEX6_AUTO' }) {
  // Fetch real market data via backend proxy
  let mData = {};
  try {
    const res = await base44.functions.invoke('marketData', {
      tickers: assets,
      lookbackDays: 365,
    });
    mData = res.data?.results || {};
  } catch (e) {
    console.warn('[HEX6] Market data fetch failed, using synthetic fallback:', e.message);
  }

  const historicalData = {};
  const assetData = {};

  assets.forEach((asset) => {
    const returns = mData[asset]?.returns || [];
    if (returns.length >= 50) {
      historicalData[asset] = returns;
      assetData[asset] = returns.slice(-30);
    } else {
      // Synthetic fallback
      historicalData[asset] = Array.from({ length: 300 }, () => (Math.random() - 0.48) * 0.025);
      assetData[asset] = historicalData[asset].slice(-30);
    }
  });

  return calculateTargetAllocation({ assetData, historicalData, triggeredBy, config: {} });
}

/**
 * onSilenceMode — zero-exposure governance event.
 * Bypasses the allocation engine and mints SILENCE receipts directly.
 */
export async function onSilenceMode({ assets, reason = 'ENGINE_DECISION', triggeredBy = 'HEX6_AUTO' }) {
  const receipts = await Promise.all(
    assets.map((assetId) =>
      mintEgtsAssetFromPie({
        assetId,
        eventType: 'SILENCE',
        allocationData: { targetWeight: 0, totalExposure: 0, marketState: 'SILENCE' },
        triggeredBy,
        metadata: { reason, engineVersion: 'HEX6-BLE-v5.0' },
      })
    )
  );
  return { receipts };
}