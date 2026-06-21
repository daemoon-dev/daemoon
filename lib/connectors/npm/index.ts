/* Daemoon — npm connector.
 *
 * Reads against registry.npmjs.org with a granular / Automation token.
 *   1) User creates a token at https://www.npmjs.com/settings/<user>/tokens
 *   2) Daemoon validates via GET /-/whoami
 *   3) Stored in vault and used
 *
 * Read-only MVP tools (publish intentionally omitted — destructive + needs
 * tarball upload):
 *   1) npm.whoami()
 *   2) npm.list_packages({ limit })
 *   3) npm.view({ package, version? })
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const REGISTRY = "https://registry.npmjs.org";

async function np<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Daemoon/0.1",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(new URL(path, REGISTRY), { ...init, headers });
  if (!res.ok) {
    throw new Error(
      `npm ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("npm not connected — paste a granular/Automation token.");
  return ctx.token;
}

const whoami: ToolDef<Record<string, never>, { username: string }> = {
  name: "npm.whoami",
  description: "Return the npm username this token belongs to.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const token = reqTok(ctx);
    const data = await np<{ username: string }>("/-/whoami", token);
    return { username: data.username };
  },
};

interface PackageHit {
  package: {
    name: string;
    version: string;
    description?: string;
    date?: string;
    links?: { homepage?: string; repository?: string };
  };
}

const listPackages: ToolDef<
  { limit?: number },
  { packages: Array<{ name: string; version: string; description?: string; updated?: string }> }
> = {
  name: "npm.list_packages",
  description: "List packages published by my npm user (most recently updated first).",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", minimum: 1, maximum: 250, default: 50 } },
    additionalProperties: false,
  },
  async handler({ limit = 50 }, ctx) {
    const token = reqTok(ctx);
    const me = await np<{ username: string }>("/-/whoami", token);
    const search = await np<{ objects: PackageHit[] }>(
      `/-/v1/search?text=maintainer:${encodeURIComponent(me.username)}&size=${limit}`,
      token,
    );
    return {
      packages: (search.objects ?? []).map(o => ({
        name: o.package.name,
        version: o.package.version,
        description: o.package.description,
        updated: o.package.date,
      })),
    };
  },
};

interface PackageMeta {
  name: string;
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, { version: string; dependencies?: Record<string, string>; license?: string }>;
  time?: Record<string, string>;
  description?: string;
  homepage?: string;
  repository?: { url?: string };
  license?: string;
  maintainers?: Array<{ name: string; email?: string }>;
}

const view: ToolDef<
  { package: string; version?: string },
  {
    name: string;
    latest: string;
    description?: string;
    license?: string;
    homepage?: string;
    repository?: string;
    versions: number;
    publishedAt?: string;
    dependencies?: Record<string, string>;
    maintainers?: string[];
  }
> = {
  name: "npm.view",
  description: "View metadata for an npm package (latest version by default). Works for public packages even without auth.",
  inputSchema: {
    type: "object",
    properties: {
      package: { type: "string", minLength: 1 },
      version: { type: "string" },
    },
    required: ["package"],
    additionalProperties: false,
  },
  async handler({ package: pkg, version }, ctx) {
    // Reads work without auth for public packages, but we still pass the token if present.
    const data = await np<PackageMeta>(`/${encodeURIComponent(pkg)}`, ctx.token ?? null);
    const latest = data["dist-tags"]?.latest ?? Object.keys(data.versions ?? {}).at(-1) ?? "";
    const target = version ?? latest;
    const v = data.versions?.[target];
    return {
      name: data.name,
      latest,
      description: data.description,
      license: v?.license ?? data.license,
      homepage: data.homepage,
      repository: data.repository?.url,
      versions: Object.keys(data.versions ?? {}).length,
      publishedAt: data.time?.[target],
      dependencies: v?.dependencies,
      maintainers: data.maintainers?.map(m => m.name),
    };
  },
};

export const npmConnector: Connector = {
  id: "npm",
  label: "npm",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("/-/whoami", REGISTRY), {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemoon/0.1" },
      });
      if (!res.ok) return { ok: false as const, reason: `npm registry ${res.status}` };
      const json = (await res.json()) as { username?: string };
      if (!json.username) return { ok: false as const, reason: "no username in whoami" };
      return { ok: true as const, meta: { username: json.username } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [whoami, listPackages, view],
};
