/**
 * runEgtsMigration
 *
 * Admin-only backend function to display the EGTS SQL migration script.
 * To apply the schema, copy the SQL from the response and run it in
 * your Supabase SQL Editor: https://app.supabase.com → SQL Editor.
 *
 * This function does NOT automatically execute DDL — Supabase anon keys
 * do not have permission to create tables. Use the Supabase dashboard
 * or the Supabase CLI to apply the migration.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MIGRATION_SQL = `
-- ============================================================
-- 002_egts_augment.sql
-- EGTS (Ethereum Governance & Transparency System) Audit Schema
-- Run this in your Supabase SQL Editor.
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

CREATE INDEX IF NOT EXISTS idx_egts_receipts_asset_id    ON egts_receipts (asset_id);
CREATE INDEX IF NOT EXISTS idx_egts_receipts_event_type  ON egts_receipts (event_type);
CREATE INDEX IF NOT EXISTS idx_egts_receipts_timestamp   ON egts_receipts (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_egts_receipts_crypto_hash ON egts_receipts (crypto_hash);

ALTER TABLE egts_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "egts_receipts_insert" ON egts_receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "egts_receipts_select" ON egts_receipts FOR SELECT USING (true);
`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    return Response.json({
      message: 'Copy the SQL below and run it in your Supabase SQL Editor at https://app.supabase.com',
      migration_id: '002_egts_augment',
      sql: MIGRATION_SQL,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});