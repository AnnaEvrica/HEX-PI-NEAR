/**
 * EGTS Service — Ethereum Governance & Transparency System
 * Handles minting of immutable, cryptographically verifiable receipts
 * for every portfolio decision made by the HEX6 BLE engine.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Generate a deterministic SHA-256 hash fingerprint for a receipt payload.
 * Uses the Web Crypto API (available in all modern browsers).
 */
async function generateReceiptHash(payload) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4 receipt ID.
 */
function generateReceiptId() {
  return crypto.randomUUID();
}

/**
 * mintEgtsAssetFromPie
 *
 * Core governance function. Called by the HEX6 BLE engine whenever:
 *  - A portfolio rebalance is triggered
 *  - "Silence" mode is activated
 *
 * Creates an immutable, cryptographically verifiable receipt and stores it
 * in the Supabase egts_receipts table.
 *
 * @param {Object} params
 * @param {string} params.assetId        - The asset/ticker being governed
 * @param {string} params.eventType      - 'REBALANCE' | 'SILENCE' | 'ALLOCATION'
 * @param {Object} params.allocationData - { weights, targetExposure, marketState, ... }
 * @param {string} params.triggeredBy    - User/system identifier
 * @param {Object} params.metadata       - Any extra metadata to embed in the receipt
 * @returns {Promise<Object>}            - The minted EGTS receipt
 */
export async function mintEgtsAssetFromPie({
  assetId,
  eventType,
  allocationData,
  triggeredBy = 'HEX6_ENGINE',
  metadata = {},
}) {
  const receiptId = generateReceiptId();
  const timestamp = new Date().toISOString();

  const payload = {
    receiptId,
    assetId,
    eventType,
    allocationData,
    triggeredBy,
    metadata,
    timestamp,
    schemaVersion: '1.0.0',
  };

  // Generate cryptographic hash fingerprint
  const cryptoHash = await generateReceiptHash(payload);

  const receipt = {
    id: receiptId,
    asset_id: assetId,
    event_type: eventType,
    allocation_data: allocationData,
    triggered_by: triggeredBy,
    metadata,
    timestamp,
    crypto_hash: cryptoHash,
    schema_version: '1.0.0',
    is_verified: true,
  };

  const { data, error } = await supabase
    .from('egts_receipts')
    .insert([receipt])
    .select()
    .single();

  if (error) {
    console.error('[EGTS] Failed to mint receipt:', error);
    throw new Error(`EGTS mint failed: ${error.message}`);
  }

  console.log(`[EGTS] Receipt minted: ${receiptId} | ${eventType} | ${assetId}`);
  return data;
}

/**
 * Fetch all EGTS receipts for a given asset, sorted by newest first.
 */
export async function getEgtsReceiptsForAsset(assetId) {
  const { data, error } = await supabase
    .from('egts_receipts')
    .select('*')
    .eq('asset_id', assetId)
    .order('timestamp', { ascending: false });

  if (error) throw new Error(`EGTS fetch failed: ${error.message}`);
  return data || [];
}

/**
 * Fetch all EGTS receipts (for dashboard/audit views).
 */
export async function getAllEgtsReceipts() {
  const { data, error } = await supabase
    .from('egts_receipts')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) throw new Error(`EGTS fetch failed: ${error.message}`);
  return data || [];
}

/**
 * Verify a receipt's integrity by recomputing its hash and comparing.
 */
export async function verifyEgtsReceipt(receipt) {
  const payload = {
    receiptId: receipt.id,
    assetId: receipt.asset_id,
    eventType: receipt.event_type,
    allocationData: receipt.allocation_data,
    triggeredBy: receipt.triggered_by,
    metadata: receipt.metadata,
    timestamp: receipt.timestamp,
    schemaVersion: receipt.schema_version,
  };

  const recomputedHash = await generateReceiptHash(payload);
  return {
    isValid: recomputedHash === receipt.crypto_hash,
    storedHash: receipt.crypto_hash,
    recomputedHash,
  };
}