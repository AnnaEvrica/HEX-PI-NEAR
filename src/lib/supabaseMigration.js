/**
 * Supabase Schema Migration
 * 002_egts_augment.sql — EGTS Audit Trail Schema
 *
 * Run this via: supabase.rpc('exec_sql', { sql: MIGRATION_SQL })
 * Or paste directly into the Supabase SQL editor in your dashboard.
 *
 * This creates the egts_receipts table for cryptographic receipt storage.
 */

export const MIGRATION_SQL = `
-- ============================================================
-- 002_egts_augment.sql
-- EGTS (Ethereum Governance & Transparency System) Audit Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS egts_receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         TEXT NOT NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN ('REBALANCE', 'SILENCE', 'ALLOCATION', 'MANUAL')),
  allocation_data  JSONB NOT NULL DEFAULT '{}',
  triggered_by     TEXT NOT NULL DEFAULT 'SYSTEM',
  metadata         JSONB NOT NULL DEFAULT '{}',
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  crypto_hash      TEXT NOT NULL,
  schema_version   TEXT NOT NULL DEFAULT '1.0.0',
  is_verified      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast asset lookups
CREATE INDEX IF NOT EXISTS idx_egts_receipts_asset_id
  ON egts_receipts (asset_id);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_egts_receipts_event_type
  ON egts_receipts (event_type);

-- Index for timestamp ordering
CREATE INDEX IF NOT EXISTS idx_egts_receipts_timestamp
  ON egts_receipts (timestamp DESC);

-- Index for hash verification lookups
CREATE INDEX IF NOT EXISTS idx_egts_receipts_crypto_hash
  ON egts_receipts (crypto_hash);

-- Row Level Security
ALTER TABLE egts_receipts ENABLE ROW LEVEL SECURITY;

-- Receipts are immutable — only INSERT allowed, no UPDATE or DELETE
CREATE POLICY "egts_receipts_insert" ON egts_receipts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "egts_receipts_select" ON egts_receipts
  FOR SELECT USING (true);

-- Prevent any updates (immutability guarantee)
-- No UPDATE or DELETE policies = those operations are blocked
`;

export const MIGRATION_DESCRIPTION = `
EGTS Receipts Table:
- Stores cryptographically verifiable receipts for every portfolio governance decision
- Immutable: RLS policies allow INSERT and SELECT only — no UPDATE or DELETE
- Indexed for fast asset, event type, timestamp, and hash lookups
- crypto_hash field enables offline integrity verification
`;