/* Daemoon PAT (personal access token) — MCP 인증용.
 *
 * 토큰 형식: dmn_<24bytes-base64url>
 *   - DB 에는 sha256(raw) 만 저장. raw 는 생성 직후 1번 노출.
 *   - lookup: 들어온 Bearer 의 sha256 으로 daemoon_pats 조회 → user_id.
 */
import { createHash, randomBytes } from "crypto";
import { getServiceClient } from "@/lib/supabase/service";

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createPat(
  userId: string,
  label?: string,
): Promise<{ raw: string; prefix: string }> {
  const raw = `dmn_${randomBytes(24).toString("base64url")}`;
  const prefix = raw.slice(0, 12);
  const { error } = await getServiceClient().from("daemoon_pats").insert({
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
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("daemoon_pats")
    .select("user_id, id")
    .eq("token_hash", hash(raw))
    .maybeSingle();
  if (error) throw new Error(`pat lookup failed: ${error.message}`);
  if (!data) return null;
  // best-effort last_used_at touch — never block auth on this
  sb.from("daemoon_pats")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(
      () => {},
      () => {},
    );
  return data.user_id as string;
}
