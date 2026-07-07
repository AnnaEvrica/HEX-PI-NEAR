/**
 * egtsProxy — Backend proxy for all EGTS Supabase operations.
 * Runs server-side so it has access to SUPABASE_URL and SUPABASE_ANON_KEY
 * without requiring VITE_ prefixed frontend env vars.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2';

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, key);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;
    const supabase = getSupabase();

    // ── MINT ──────────────────────────────────────────────────────────────
    if (action === 'mint') {
      // Only admins may mint governance receipts — protects EGTS audit integrity.
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { data, error } = await supabase
        .from('egts_receipts')
        .insert([payload])
        .select()
        .single();
      if (error) throw new Error(`Mint failed: ${error.message}`);
      return Response.json({ data });
    }

    // ── FETCH ALL ─────────────────────────────────────────────────────────
    if (action === 'fetchAll') {
      const { data, error } = await supabase
        .from('egts_receipts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Fetch failed: ${error.message}`);
      return Response.json({ data: data || [] });
    }

    // ── FETCH BY ASSET ────────────────────────────────────────────────────
    if (action === 'fetchByAsset') {
      const { data, error } = await supabase
        .from('egts_receipts')
        .select('*')
        .eq('asset_id', payload.assetId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Fetch failed: ${error.message}`);
      return Response.json({ data: data || [] });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});