/* Daemoon — Cloudflare connector.
 *
 * Cloudflare *does not support OAuth* — *API Token* only (user creates and pastes).
 *   1) User visits dash.cloudflare.com/profile/api-tokens and creates a token
 *   2) Daemoon validates it (GET /user/tokens/verify)
 *   3) Stored in vault and used
 *
 * MVP tools:
 *   1) cloudflare.list_zones()
 *   2) cloudflare.create_dns_record({ zoneId, type, name, content, proxied? })
 *   3) cloudflare.register_domain({ name, years })  // Cloudflare Registrar API
 *
 * In Phase 1, domain registration is *only allowed for paid Cloudflare accounts*
 * (\$15/yr card on file) → first-time payment is handled via an external dashboard link.
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.cloudflare.com/client/v4";

async function cf<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API + "/"), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Daemoon/0.1",
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
  description: "List my zones (domains) registered with Cloudflare.",
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

const createDnsRecord: ToolDef<
  { zoneId: string; type: string; name: string; content: string; proxied?: boolean; ttl?: number },
  { id: string; name: string; content: string }
> = {
  name: "cloudflare.create_dns_record",
  description: "Add a DNS record (A/AAAA/CNAME/TXT etc).",
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
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemoon/0.1" },
      });
      const json = (await res.json()) as { success: boolean; result?: { status: string; id?: string } };
      if (!res.ok || !json.success) return { ok: false as const, reason: "Token verification failed (Cloudflare API)" };
      if (json.result?.status !== "active") return { ok: false as const, reason: `Token status: ${json.result?.status}` };
      return { ok: true as const, meta: { tokenId: json.result?.id } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [listZones, createDnsRecord],
};
