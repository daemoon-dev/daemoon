/* Daemoon — Vercel connector.
 *
 * OAuth (Vercel Integration / OAuth App):
 *   - authorize:  https://vercel.com/oauth/authorize
 *   - exchange:   POST https://api.vercel.com/v2/oauth/access_token
 *   - env vars:   VERCEL_CLIENT_ID, VERCEL_CLIENT_SECRET (set after registering the Daemoon Vercel Integration)
 *
 * Vercel API base: https://api.vercel.com
 * Auth header: Authorization: Bearer <token>
 *
 * MVP tools (3):
 *   1) vercel.list_projects()
 *   2) vercel.create_project({ name, framework })
 *   3) vercel.create_deployment({ projectId, gitRepoId, teamId? })
 */
import type { Connector, OAuthExchanged, OAuthStart, ToolContext, ToolDef } from "../types";

const API = "https://api.vercel.com";
const UA = "Daemoon/1.1 (+https://daemoon.dev)";

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
      "User-Agent": UA,
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

const listProjects: ToolDef<
  { limit?: number; teamId?: string },
  { projects: Array<{ id: string; name: string; framework: string | null }> }
> = {
  name: "vercel.list_projects",
  description: "List my Vercel projects (up to 100). Pass teamId to list a team's projects.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
      teamId: { type: "string", description: "Vercel team id (team_…). Omit for personal." },
    },
    additionalProperties: false,
  },
  async handler({ limit = 20, teamId }, ctx) {
    const token = requireToken(ctx);
    const data = await vfetch<{ projects: Array<{ id: string; name: string; framework: string | null }> }>({
      path: "/v9/projects",
      query: { limit: String(limit), teamId },
      token,
    });
    return { projects: data.projects.map(p => ({ id: p.id, name: p.name, framework: p.framework })) };
  },
};

const createProject: ToolDef<
  { name: string; framework?: string; teamId?: string },
  { id: string; name: string }
> = {
  name: "vercel.create_project",
  description: "Create a new Vercel project. name must be url-safe lowercase.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 64, pattern: "^[a-z0-9][a-z0-9-]*[a-z0-9]$" },
      framework: {
        type: "string",
        enum: ["nextjs", "vite", "remix", "astro", "sveltekit", "nuxtjs"],
        default: "nextjs",
      },
      teamId: { type: "string" },
    },
    required: ["name"],
    additionalProperties: false,
  },
  async handler({ name, framework = "nextjs", teamId }, ctx) {
    const token = requireToken(ctx);
    const data = await vfetch<{ id: string; name: string }>({
      method: "POST",
      path: "/v10/projects",
      query: { teamId },
      token,
      body: { name, framework },
    });
    return { id: data.id, name: data.name };
  },
};

const createDeployment: ToolDef<
  { projectId: string; gitRepoId: string | number; ref?: string; teamId?: string },
  { id: string; url: string; readyState: string }
> = {
  name: "vercel.create_deployment",
  description: "Trigger a production deployment of a GitHub repo ref (default 'main') to a Vercel project.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", minLength: 1 },
      gitRepoId: {
        oneOf: [{ type: "number" }, { type: "string", pattern: "^[0-9]+$" }],
        description: "GitHub repo numeric id (number or string-of-digits).",
      },
      ref: { type: "string", default: "main" },
      teamId: { type: "string" },
    },
    required: ["projectId", "gitRepoId"],
    additionalProperties: false,
  },
  async handler({ projectId, gitRepoId, ref = "main", teamId }, ctx) {
    const token = requireToken(ctx);
    const repoIdNum = typeof gitRepoId === "number" ? gitRepoId : Number(gitRepoId);
    if (!Number.isFinite(repoIdNum) || repoIdNum <= 0) {
      throw new Error("gitRepoId must be a positive integer.");
    }
    const data = await vfetch<{ id: string; url: string; readyState: string }>({
      method: "POST",
      path: "/v13/deployments",
      query: { teamId },
      token,
      body: {
        name: projectId,
        project: projectId,
        target: "production",
        gitSource: { type: "github", repoId: repoIdNum, ref },
      },
    });
    return { id: data.id, url: data.url, readyState: data.readyState };
  },
};

export const vercelConnector: Connector = {
  id: "vercel",
  label: "Vercel",
  // MVP: support both. UI prefers OAuth; falls back to a PAT form if env vars are missing.
  oauthSupported: true,

  async validatePat(pat: string) {
    try {
      const res = await fetch(`${API}/v2/user`, {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": UA },
      });
      if (!res.ok) return { ok: false as const, reason: `Vercel API ${res.status}` };
      const user = (await res.json()) as { user?: { id?: string; username?: string; email?: string } };
      return { ok: true as const, meta: { username: user.user?.username, email: user.user?.email, id: user.user?.id } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

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

  tools: [listProjects, createProject, createDeployment],
};
