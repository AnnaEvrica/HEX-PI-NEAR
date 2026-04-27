/**
 * HEX6 BLE Engine — Quantitative Allocation Logic
 *
 * This module houses the state-conditioned market data processing and
 * target portfolio exposure weight calculations.
 *
 * TODO: Replace stub implementations with your proprietary HEX6 quantitative logic.
 *
 * Integration contract:
 *  - All rebalance/silence events MUST call mintEgtsAssetFromPie() from egtsService.
 *  - The governance loop is triggered via onRebalance() and onSilenceMode().
 */

import { mintEgtsAssetFromPie } from './egtsService';

// ---------------------------------------------------------------------------
// TODO: Define your market state enum / conditions here
// ---------------------------------------------------------------------------
export const MARKET_STATES = {
  BULL: 'BULL',
  BEAR: 'BEAR',
  LATERAL: 'LATERAL',
  VOLATILE: 'VOLATILE',
  SILENCE: 'SILENCE',
};

// ---------------------------------------------------------------------------
// TODO: Replace with your real HEX6 BLE weight calculation logic
// ---------------------------------------------------------------------------
/**
 * calculateTargetWeights
 *
 * Computes target portfolio exposure weights given a market state and asset universe.
 *
 * @param {string} marketState    - One of MARKET_STATES
 * @param {Array}  assets         - Array of asset identifiers
 * @param {Object} marketData     - Raw market data inputs (prices, vol, momentum, etc.)
 * @returns {Object}              - { weights: { [assetId]: number }, totalExposure: number }
 */
export function calculateTargetWeights(marketState, assets, marketData = {}) {
  // TODO: Replace this stub with your proprietary HEX6 allocation algorithm
  console.warn('[HEX6] calculateTargetWeights — using STUB implementation');

  const equalWeight = 1 / assets.length;
  const weights = {};

  assets.forEach((asset) => {
    // TODO: Apply state-conditioned weighting logic per asset
    let stateMultiplier = 1.0;
    if (marketState === MARKET_STATES.BULL) stateMultiplier = 1.2;
    if (marketState === MARKET_STATES.BEAR) stateMultiplier = 0.6;
    if (marketState === MARKET_STATES.SILENCE) stateMultiplier = 0.0;
    weights[asset] = Math.min(equalWeight * stateMultiplier, 1);
  });

  const totalExposure = Object.values(weights).reduce((a, b) => a + b, 0);

  return { weights, totalExposure, marketState };
}

// ---------------------------------------------------------------------------
// TODO: Replace with your real market state detection logic
// ---------------------------------------------------------------------------
/**
 * detectMarketState
 *
 * Determines the current market state from raw market data inputs.
 *
 * @param {Object} marketData - { volatility, trend, momentum, ... }
 * @returns {string}          - One of MARKET_STATES
 */
export function detectMarketState(marketData = {}) {
  // TODO: Replace with your HEX6 BLE state-detection algorithm
  console.warn('[HEX6] detectMarketState — using STUB implementation');

  const { volatility = 0.15, trend = 0 } = marketData;

  if (volatility > 0.4) return MARKET_STATES.VOLATILE;
  if (trend > 0.05) return MARKET_STATES.BULL;
  if (trend < -0.05) return MARKET_STATES.BEAR;
  return MARKET_STATES.LATERAL;
}

// ---------------------------------------------------------------------------
// GOVERNANCE LOOP — Do NOT modify the EGTS call signatures
// ---------------------------------------------------------------------------

/**
 * onRebalance
 *
 * Called when the HEX6 engine determines a portfolio rebalance is required.
 * Computes new weights and mints an EGTS receipt for the decision.
 *
 * @param {Object} params
 * @param {Array}  params.assets      - Asset universe
 * @param {Object} params.marketData  - Current market data
 * @param {string} params.triggeredBy - Who/what triggered this
 */
export async function onRebalance({ assets, marketData, triggeredBy = 'HEX6_AUTO' }) {
  const marketState = detectMarketState(marketData);
  const allocationResult = calculateTargetWeights(marketState, assets, marketData);

  // TODO: Add any pre-rebalance validation logic here

  // GOVERNANCE LOOP — mint immutable receipt for every rebalance decision
  const receipts = await Promise.all(
    assets.map((assetId) =>
      mintEgtsAssetFromPie({
        assetId,
        eventType: 'REBALANCE',
        allocationData: {
          targetWeight: allocationResult.weights[assetId],
          totalExposure: allocationResult.totalExposure,
          marketState,
          marketData,
        },
        triggeredBy,
        metadata: {
          engineVersion: 'HEX6-BLE-STUB-1.0',
          allAssets: assets,
        },
      })
    )
  );

  console.log(`[HEX6] Rebalance complete. ${receipts.length} EGTS receipts minted.`);
  return { allocationResult, receipts };
}

/**
 * onSilenceMode
 *
 * Called when the HEX6 engine enters "Silence" mode — zero exposure state.
 * Mints an EGTS receipt for every asset to record the silence decision.
 *
 * @param {Object} params
 * @param {Array}  params.assets      - Asset universe
 * @param {string} params.reason      - Reason for silence
 * @param {string} params.triggeredBy - Who/what triggered this
 */
export async function onSilenceMode({ assets, reason = 'ENGINE_DECISION', triggeredBy = 'HEX6_AUTO' }) {
  // GOVERNANCE LOOP — mint immutable receipt for silence decision
  const receipts = await Promise.all(
    assets.map((assetId) =>
      mintEgtsAssetFromPie({
        assetId,
        eventType: 'SILENCE',
        allocationData: {
          targetWeight: 0,
          totalExposure: 0,
          marketState: MARKET_STATES.SILENCE,
        },
        triggeredBy,
        metadata: {
          reason,
          engineVersion: 'HEX6-BLE-STUB-1.0',
        },
      })
    )
  );

  console.log(`[HEX6] Silence mode. ${receipts.length} EGTS receipts minted.`);
  return { receipts };
}