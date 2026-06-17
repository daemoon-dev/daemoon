/* Daemun — Vercel connector.
 *
 * OAuth (Vercel Integration / OAuth App):
 *   - authorize:  https://vercel.com/oauth/authorize
 *   - exchange:   POST https://api.vercel.com/v2/oauth/access_token
 *   - 환경변수:    VERCEL_CLIENT_ID, VERCEL_CLIENT_SECRET (Daemun 의 Vercel Integration 등록 후)
 *
 * Vercel API base: https://api.vercel.com
 * 인증 헤더: Authorization: Bearer <token>
 *
 * MVP 도구 (3개):
 *   1) vercel.list_projects()
 *   2) vercel.create_project({ name, framework })
 *   3) vercel.deploy({ projectId, gitSource })   // GitHub repo 의 main 브랜치 자동 deploy
 *
 * 추가 도구는 같은 패턴으로 추가 (open core 확장 가능).
 */
import type { Connector, OAuthExchanged, OAuthStart, ToolContext, ToolDef } from "../types";

const API = "https://api.vercel.com";

interface VercelFetchOpts {
  method?: string;
  path: string;
  token: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

async function vfetch<T>(opts: VercelFetchOpts): Promise<T> {
  const url = new URL(opts.path, API);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
      "User-Agent": "Daemun/0.1 (+https://daemun.ai)",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel ${opts.method ?? "GET"} ${opts.path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

function requireToken(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("Vercel not connected — call /connect/vercel first.");
  return ctx.token;
}

const listProjects: ToolDef<{ limit?: number }, { projects: Array<{ id: string; name: string; framework: string | null }> }> = {
  name: "vercel.list_projects",
  description: "Vercel 의 내 프로젝트 목록 (최대 20개).",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", minimum: 1, maximum: 100, default: 20 } },
    additionalProperties: false,
  },
  async handler({ limit = 20 }, ctx) {
    const token = requireToken(ctx);
    const data = await vfetch<{ projects: Array<{ id: string; name: string; framework: string | null }> }>({
      path: "/v9/projects",
      query: { limit: String(limit) },
      token,
    });
    return { projects: data.projects.map(p => ({ id: p.id, name: p.name, framework: p.framework })) };
  },
};

const createProject: ToolDef<{ name: string; framework?: string }, { id: string; name: string }> = {
  name: "vercel.create_project",
  description: "Vercel 신규 프로젝트 생성. name 은 url-safe 소문자.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$" },
      framework: { type: "string", enum: ["nextjs", "vite", "remix", "astro", "svelte", "nuxt"], default: "nextjs" },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async handler({ name, framework = "nextjs" }, ctx) {
    const token = requireToken(ctx);
    const data = await vfetch<{ id: string; name: string }>({
      method: "POST",
      path: "/v10/projects",
      token,
      body: { name, framework },
    });
    return { id: data.id, name: data.name };
  },
};

const deploy: ToolDef<{ projectId: string; gitRepoId: string; ref?: string }, { id: string; url: string; readyState: string }> = {
  name: "vercel.deploy",
  description: "GitHub repo 의 특정 ref (default 'main') 를 Vercel 프로젝트에 배포 trigger.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      gitRepoId: { type: "string", description: "GitHub repo numeric id" },
      ref: { type: "string", default: "main" },
    },
    required: ["projectId", "gitRepoId"],
    additionalProperties: false,
  },
  async handler({ projectId, gitRepoId, ref = "main" }, ctx) {
    const token = requireToken(ctx);
    const data = await vfetch<{ id: string; url: string; readyState: string }>({
      method: "POST",
      path: "/v13/deployments",
      token,
      body: {
        name: projectId,
        project: projectId,
        target: "production",
        gitSource: { type: "github", repoId: gitRepoId, ref },
      },
    });
    return { id: data.id, url: data.url, readyState: data.readyState };
  },
};

export const vercelConnector: Connector = {
  id: "vercel",
  label: "Vercel",
  oauthSupported: true,

  oauthStart(redirectUri, state): OAuthStart {
    const clientId = process.env.VERCEL_CLIENT_ID;
    if (!clientId) throw new Error("VERCEL_CLIENT_ID not configured");
    const url = new URL("https://vercel.com/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return { authorizeUrl: url.toString(), state };
  },

  async oauthExchange(code, redirectUri): Promise<OAuthExchanged> {
    const clientId = process.env.VERCEL_CLIENT_ID;
    const clientSecret = process.env.VERCEL_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("VERCEL OAuth env not configured");
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vercel OAuth exchange failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      token_type: string;
      user_id: string;
      team_id?: string;
      installation_id?: string;
    };
    return {
      token: data.access_token,
      providerUserId: data.user_id,
      meta: { team_id: data.team_id, installation_id: data.installation_id },
    };
  },

  tools: [listProjects, createProject, deploy],
};
