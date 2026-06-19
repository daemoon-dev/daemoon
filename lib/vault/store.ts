/* Daemoon vault store — per-user token storage backed by Supabase.
 *
 * Schema (Supabase):
 *   create table public.daemoon_tokens (
 *     id            uuid primary key default gen_random_uuid(),
 *     user_id       uuid not null references auth.users(id) on delete cascade,
 *     provider      text not null,             -- 'vercel', 'cloudflare', ...
 *     ciphertext    text not null,
 *     iv1           text not null,
 *     tag1          text not null,
 *     wrapped_dek   text not null,
 *     iv2           text not null,
 *     tag2          text not null,
 *     key_version   int  not null,
 *     refresh_token_enc jsonb,                  -- refresh token uses the same envelope
 *     expires_at    timestamptz,
 *     provider_user_id text,                    -- provider-side identifier
 *     meta          jsonb,
 *     created_at    timestamptz not null default now(),
 *     updated_at    timestamptz not null default now(),
 *     unique (user_id, provider)
 *   );
 *   alter table public.daemoon_tokens enable row level security;
 *   -- RLS: block SELECT/INSERT/UPDATE for anon and authenticated. service_role only.
 *   revoke all on public.daemoon_tokens from anon, authenticated;
 *
 * All vault access uses the *service_role* key (server-side only).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptToken, decryptToken, type EncryptedToken } from "./encryption";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL not configured");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export interface StoredToken {
  token: string;
  refreshToken?: string;
  expiresAt?: Date;
  providerUserId?: string;
  meta?: Record<string, unknown>;
}

export async function saveToken(
  userId: string,
  provider: string,
  payload: StoredToken,
): Promise<void> {
  const enc = encryptToken(payload.token);
  const refreshEnc = payload.refreshToken ? encryptToken(payload.refreshToken) : null;
  const { error } = await client()
    .from("daemoon_tokens")
    .upsert(
      {
        user_id: userId,
        provider,
        ciphertext: enc.ciphertext,
        iv1: enc.iv1,
        tag1: enc.tag1,
        wrapped_dek: enc.wrappedDek,
        iv2: enc.iv2,
        tag2: enc.tag2,
        key_version: enc.keyVersion,
        refresh_token_enc: refreshEnc as unknown as Record<string, unknown> | null,
        expires_at: payload.expiresAt?.toISOString() ?? null,
        provider_user_id: payload.providerUserId ?? null,
        meta: payload.meta ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    );
  if (error) throw error;
}

export async function loadToken(
  userId: string,
  provider: string,
): Promise<StoredToken | null> {
  const { data, error } = await client()
    .from("daemoon_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const enc: EncryptedToken = {
    ciphertext: data.ciphertext,
    iv1: data.iv1,
    tag1: data.tag1,
    wrappedDek: data.wrapped_dek,
    iv2: data.iv2,
    tag2: data.tag2,
    keyVersion: data.key_version,
  };
  const token = decryptToken(enc);
  const refreshToken = data.refresh_token_enc
    ? decryptToken(data.refresh_token_enc as EncryptedToken)
    : undefined;
  return {
    token,
    refreshToken,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    providerUserId: data.provider_user_id ?? undefined,
    meta: data.meta ?? undefined,
  };
}

export async function deleteToken(userId: string, provider: string): Promise<void> {
  const { error } = await client()
    .from("daemoon_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw error;
}
