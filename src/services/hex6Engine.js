/**
 * hex6Engine.js
 *
 * Convenience wrappers for Dashboard.jsx / AssetDetail.jsx.
 * The canonical HEX6 BLE v5.0 engine lives in hex6Engine.ts.
 */

import { calculateTargetAllocation } from './hex6Engine.ts';
import { mintEgtsAssetFromPie } from './egtsService';

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
 * onRebalance — triggers the full HEX6 BLE v5.0 SCEFM engine.
 *
 * TODO: Replace stub synthetic return series with real time-series data
 * from your market data provider before going live.
 */
export async function onRebalance({ assets, marketData = {}, triggeredBy = 'HEX6_AUTO' }) {
  const trend = marketData.trend ?? 0.01;
  const vol = marketData.volatility ?? 0.15;

  const historicalData = {};
  const assetData = {};

  assets.forEach((asset) => {
    // Stub: synthetic 30-period return series
    // TODO: Replace with real return series
    historicalData[asset] = Array.from(
      { length: 30 },
      () => trend + (Math.random() - 0.5) * vol
    );
    assetData[asset] = historicalData[asset].slice(-8);
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