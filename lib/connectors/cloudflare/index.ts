/* Daemun — Cloudflare connector.
 *
 * Cloudflare 는 *OAuth 미지원* — *API Token* 만 사용 (사용자 직접 만들어서 paste).
 *   1) 사용자가 dash.cloudflare.com/profile/api-tokens 가서 토큰 생성
 *   2) Daemun 가 토큰 유효성 검증 (GET /user/tokens/verify)
 *   3) vault 저장 후 사용
 *
 * MVP 도구:
 *   1) cloudflare.list_zones()
 *   2) cloudflare.add_dns_record({ zoneId, type, name, content, proxied? })
 *   3) cloudflare.register_domain({ name, years })  // Cloudflare Registrar API
 *
 * Phase 1 에선 domain register 는 *Cloudflare 가 paid 사용자만 허용* (\$15/년 카드 등록 필요)
 * → 사용자 첫 결제 흐름은 dashboard 외부 link 로 처리.
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.cloudflare.com/client/v4";

async function cf<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API + "/"), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Daemun/0.1",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as { success: boolean; errors?: Array<{ message: string }>; result?: T };
  if (!res.ok || !json.success) {
    const err = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Cloudflare ${init.method ?? "GET"} ${path}: ${err}`);
  }
  return json.result as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("Cloudflare not connected — paste API token.");
  return ctx.token;
}

const listZones: ToolDef<{ limit?: number }, { zones: Array<{ id: string; name: string; status: string }> }> = {
  name: "cloudflare.list_zones",
  description: "Cloudflare 에 등록된 내 zone (도메인) 목록.",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", minimum: 1, maximum: 100, default: 50 } },
    additionalProperties: false,
  },
  async handler({ limit = 50 }, ctx) {
    const token = reqTok(ctx);
    const zones = await cf<Array<{ id: string; name: string; status: string }>>(
      `zones?per_page=${limit}`,
      token,
    );
    return { zones: zones.map(z => ({ id: z.id, name: z.name, status: z.status })) };
  },
};

const addDnsRecord: ToolDef<
  { zoneId: string; type: string; name: string; content: string; proxied?: boolean; ttl?: number },
  { id: string; name: string; content: string }
> = {
  name: "cloudflare.add_dns_record",
  description: "DNS 레코드 추가 (A/AAAA/CNAME/TXT 등).",
  inputSchema: {
    type: "object",
    properties: {
      zoneId: { type: "string" },
      type: { type: "string", enum: ["A", "AAAA", "CNAME", "TXT", "MX", "NS"] },
      name: { type: "string" },
      content: { type: "string" },
      proxied: { type: "boolean", default: false },
      ttl: { type: "number", default: 1 },
    },
    required: ["zoneId", "type", "name", "content"],
    additionalProperties: false,
  },
  async handler({ zoneId, type, name, content, proxied = false, ttl = 1 }, ctx) {
    const token = reqTok(ctx);
    const data = await cf<{ id: string; name: string; content: string }>(
      `zones/${zoneId}/dns_records`,
      token,
      { method: "POST", body: JSON.stringify({ type, name, content, proxied, ttl }) },
    );
    return { id: data.id, name: data.name, content: data.content };
  },
};

export const cloudflareConnector: Connector = {
  id: "cloudflare",
  label: "Cloudflare",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("user/tokens/verify", API + "/"), {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemun/0.1" },
      });
      const json = (await res.json()) as { success: boolean; result?: { status: string; id?: string } };
      if (!res.ok || !json.success) return { ok: false as const, reason: "토큰 검증 실패 (Cloudflare API)" };
      if (json.result?.status !== "active") return { ok: false as const, reason: `토큰 상태: ${json.result?.status}` };
      return { ok: true as const, meta: { tokenId: json.result?.id } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [listZones, addDnsRecord],
};
