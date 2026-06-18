/* Daemoon — Resend connector.
 *
 * Resend = transactional email API. OAuth 없음 — API key (re_…) 만.
 *   1) 사용자가 resend.com/api-keys 에서 token 발급
 *   2) Daemoon 가 GET /domains 로 유효성 검증
 *   3) vault 저장 후 사용
 *
 * MVP 도구:
 *   1) resend.send_email({ from, to, subject, html?, text? })
 *   2) resend.list_domains()
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.resend.com";

async function rs<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Daemoon/0.1",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Resend ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("Resend not connected — paste API key.");
  return ctx.token;
}

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  region?: string;
  created_at?: string;
}

const sendEmail: ToolDef<
  { from: string; to: string | string[]; subject: string; html?: string; text?: string },
  { id: string }
> = {
  name: "resend.send_email",
  description: "이메일 발송. from 도메인은 미리 verify 되어 있어야 함.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", minLength: 1 },
      to: {
        oneOf: [
          { type: "string", minLength: 1 },
          { type: "array", items: { type: "string" }, minItems: 1 },
        ],
      },
      subject: { type: "string", minLength: 1 },
      html: { type: "string" },
      text: { type: "string" },
    },
    required: ["from", "to", "subject"],
    additionalProperties: false,
  },
  async handler({ from, to, subject, html, text }, ctx) {
    const token = reqTok(ctx);
    const payload: Record<string, unknown> = { from, to, subject };
    if (html !== undefined) payload.html = html;
    if (text !== undefined) payload.text = text;
    const data = await rs<{ id: string }>(
      "/emails",
      token,
      { method: "POST", body: JSON.stringify(payload) },
    );
    return { id: data.id };
  },
};

const listDomains: ToolDef<
  Record<string, never>,
  { domains: Array<{ id: string; name: string; status: string; region?: string }> }
> = {
  name: "resend.list_domains",
  description: "내 Resend domains 목록.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const token = reqTok(ctx);
    const data = await rs<{ data: ResendDomain[] }>("/domains", token);
    return {
      domains: (data.data ?? []).map(d => ({ id: d.id, name: d.name, status: d.status, region: d.region })),
    };
  },
};

export const resendConnector: Connector = {
  id: "resend",
  label: "Resend",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("/domains", API), {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemoon/0.1" },
      });
      if (!res.ok) return { ok: false as const, reason: `Resend API ${res.status}` };
      const json = (await res.json()) as { data?: ResendDomain[] };
      return { ok: true as const, meta: { domainCount: json.data?.length ?? 0 } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [sendEmail, listDomains],
};
