/**
 * EGTS Service — Evrica Global Token Standard
 * Routes all Supabase operations through the egtsProxy backend function
 * so server-side secrets (SUPABASE_URL, SUPABASE_ANON_KEY) are used directly.
 */

import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Crypto utilities (browser-side, no Supabase needed)
// ---------------------------------------------------------------------------

async function generateReceiptHash(payload) {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// mintEgtsAssetFromPie
// ---------------------------------------------------------------------------

export async function mintEgtsAssetFromPie({
  assetId,
  eventType,
  allocationData,
  triggeredBy = 'HEX6_ENGINE',
  metadata = {},
}) {
  const receiptId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const payload = {
    receiptId, assetId, eventType, allocationData,
    triggeredBy, metadata, timestamp, schemaVersion: '1.0.0',
  };

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

  const response = await base44.functions.invoke('egtsProxy', {
    action: 'mint',
    payload: receipt,
  });

  if (response.data?.error) throw new Error(`EGTS mint failed: ${response.data.error}`);
  console.log(`[EGTS] Receipt minted: ${receiptId} | ${eventType} | ${assetId}`);
  return response.data?.data;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

export async function getAllEgtsReceipts() {
  const response = await base44.functions.invoke('egtsProxy', { action: 'fetchAll' });
  if (response.data?.error) throw new Error(`EGTS fetch failed: ${response.data.error}`);
  return response.data?.data || [];
}

export async function getEgtsReceiptsForAsset(assetId) {
  const response = await base44.functions.invoke('egtsProxy', {
    action: 'fetchByAsset',
    payload: { assetId },
  });
  if (response.data?.error) throw new Error(`EGTS fetch failed: ${response.data.error}`);
  return response.data?.data || [];
}

// ---------------------------------------------------------------------------
// Verify (browser-side, no network needed)
// ---------------------------------------------------------------------------

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