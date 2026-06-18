/* Single memoized Supabase service-role client (server-only).
 * Never import from a "use client" file. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL not configured");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
