/* Daemoon PAT (personal access token) — MCP 인증용.
 *
 * 토큰 형식: dmn_<24bytes-base64url>
 *   - DB 에는 sha256(raw) 만 저장. raw 는 생성 직후 1번 노출.
 *   - lookup: 들어온 Bearer 의 sha256 으로 daemoon_pats 조회 → user_id.
 */
import { createHash, randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createPat(
  userId: string,
  label?: string,
): Promise<{ raw: string; prefix: string }> {
  const raw = `dmn_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 12);
  const sb = service();
  const { error } = await sb.from("daemoon_pats").insert({
    user_id: userId,
    label: label ?? null,
    token_hash: hash(raw),
    prefix,
  });
  if (error) throw new Error(`pat insert failed: ${error.message}`);
  return { raw, prefix };
}

export async function lookupPat(raw: string): Promise<string | null> {
  if (!raw.startsWith("dmn_")) return null;
  const sb = service();
  const { data, error } = await sb
    .from("daemoon_pats")
    .select("user_id, id")
    .eq("token_hash", hash(raw))
    .maybeSingle();
  if (error || !data) return null;
  // best-effort last_used_at touch (non-blocking)
  sb.from("daemoon_pats").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data.user_id as string;
}
