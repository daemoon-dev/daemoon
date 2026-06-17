/* Daemun — Supabase connector (Management API).
 *
 * Supabase Management 는 *Personal Access Token (PAT)* 만 — OAuth 없음.
 * 사용자가 https://supabase.com/dashboard/account/tokens 에서 만들어 paste.
 *
 * API base: https://api.supabase.com (Bearer PAT)
 *
 * MVP 도구:
 *   1) supabase.list_projects()
 *   2) supabase.create_project({ name, region, organization_id, db_password })
 *   3) supabase.run_sql({ projectRef, query })
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.supabase.com";

async function sb<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Daemun/0.1",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("Supabase not connected — paste PAT.");
  return ctx.token;
}

const listProjects: ToolDef<Record<string, never>, { projects: Array<{ id: string; name: string; region: string; status: string }> }> = {
  name: "supabase.list_projects",
  description: "내 Supabase 프로젝트 목록.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const token = reqTok(ctx);
    const data = await sb<Array<{ id: string; name: string; region: string; status: string }>>(
      "/v1/projects",
      token,
    );
    return { projects: data.map(p => ({ id: p.id, name: p.name, region: p.region, status: p.status })) };
  },
};

const runSql: ToolDef<{ projectRef: string; query: string }, { result: unknown }> = {
  name: "supabase.run_sql",
  description: "특정 Supabase 프로젝트에 SQL 실행. SELECT/DDL/DML 모두. RPC 만들 때 유용.",
  inputSchema: {
    type: "object",
    properties: {
      projectRef: { type: "string", minLength: 20, maxLength: 20 },
      query: { type: "string", minLength: 1 },
    },
    required: ["projectRef", "query"],
    additionalProperties: false,
  },
  async handler({ projectRef, query }, ctx) {
    const token = reqTok(ctx);
    const result = await sb<unknown>(
      `/v1/projects/${projectRef}/database/query`,
      token,
      { method: "POST", body: JSON.stringify({ query }) },
    );
    return { result };
  },
};

export const supabaseConnector: Connector = {
  id: "supabase",
  label: "Supabase",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("/v1/projects", API), {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemun/0.1" },
      });
      if (!res.ok) return { ok: false as const, reason: `Supabase API ${res.status}` };
      const list = (await res.json()) as Array<unknown>;
      return { ok: true as const, meta: { projectCount: list.length } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [listProjects, runSql],
};
