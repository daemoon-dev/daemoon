/* Daemoon — GitHub connector.
 *
 * OAuth:
 *   authorize: https://github.com/login/oauth/authorize
 *   exchange:  POST https://github.com/login/oauth/access_token
 *   scopes:    'repo workflow user:email' (MVP)
 *   env:       GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *
 * API base: https://api.github.com (Bearer token)
 *
 * MVP 도구:
 *   1) github.list_repos()
 *   2) github.create_repo({ name, private })
 *   3) github.push_initial_commit({ owner, repo, files })  // tree+commit API
 */
import type { Connector, OAuthExchanged, OAuthStart, ToolContext, ToolDef } from "../types";

const API = "https://api.github.com";

async function gh<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Daemoon/0.1",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("GitHub not connected.");
  return ctx.token;
}

const listRepos: ToolDef<{ limit?: number }, { repos: Array<{ id: number; name: string; full_name: string; private: boolean }> }> = {
  name: "github.list_repos",
  description: "내 GitHub 저장소 목록 (최신순).",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", minimum: 1, maximum: 100, default: 30 } },
    additionalProperties: false,
  },
  async handler({ limit = 30 }, ctx) {
    const token = reqTok(ctx);
    const data = await gh<Array<{ id: number; name: string; full_name: string; private: boolean }>>(
      `/user/repos?per_page=${limit}&sort=updated`,
      token,
    );
    return { repos: data.map(r => ({ id: r.id, name: r.name, full_name: r.full_name, private: r.private })) };
  },
};

const createRepo: ToolDef<{ name: string; private?: boolean; description?: string }, { id: number; name: string; full_name: string; clone_url: string }> = {
  name: "github.create_repo",
  description: "신규 저장소 생성 (private 기본). description 선택.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-zA-Z0-9._-]+$" },
      private: { type: "boolean", default: true },
      description: { type: "string", maxLength: 350 },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async handler({ name, private: isPrivate = true, description }, ctx) {
    const token = reqTok(ctx);
    const data = await gh<{ id: number; name: string; full_name: string; clone_url: string }>(
      "/user/repos",
      token,
      {
        method: "POST",
        body: JSON.stringify({ name, private: isPrivate, description, auto_init: true }),
      },
    );
    return { id: data.id, name: data.name, full_name: data.full_name, clone_url: data.clone_url };
  },
};

export const githubConnector: Connector = {
  id: "github",
  label: "GitHub",
  oauthSupported: true,

  async validatePat(pat: string) {
    try {
      const res = await fetch(`${API}/user`, {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "Daemoon/0.1",
        },
      });
      if (!res.ok) return { ok: false as const, reason: `GitHub API ${res.status}` };
      const user = (await res.json()) as { id?: number; login?: string };
      return { ok: true as const, meta: { login: user.login, id: user.id } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  oauthStart(redirectUri, state): OAuthStart {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) throw new Error("GITHUB_CLIENT_ID not configured");
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "repo workflow user:email");
    return { authorizeUrl: url.toString(), state };
  },

  async oauthExchange(code, redirectUri): Promise<OAuthExchanged> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("GitHub OAuth env not configured");
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    if (!res.ok) throw new Error(`GitHub OAuth exchange failed: ${res.status}`);
    const data = (await res.json()) as { access_token: string; scope: string; token_type: string };
    if (!data.access_token) throw new Error(`GitHub OAuth empty token: ${JSON.stringify(data)}`);
    // user info
    const user = await gh<{ id: number; login: string }>("/user", data.access_token);
    return { token: data.access_token, providerUserId: String(user.id), meta: { login: user.login, scopes: data.scope } };
  },

  tools: [listRepos, createRepo],
};
