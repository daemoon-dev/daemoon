/* HTTP MCP endpoint — called by Claude Code / Cursor / etc.
 *
 * Auth:
 *   1) `Authorization: Bearer dmn_xxx` (PAT) → primary path for MCP clients
 *   2) Session cookie → logged-in browser calls (for dashboard debugging)
 *
 * POST /api/mcp
 * { "method": "tools/list" }
 * { "method": "tools/call", "params": { name: "vercel.list_projects", arguments: {...} } }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { lookupPat } from "@/lib/pat";
import { getConnector, listConnectors } from "@/lib/connectors/registry";
import { loadToken } from "@/lib/vault/store";
import type { ToolContext } from "@/lib/connectors/types";
import { getServiceClient } from "@/lib/supabase/service";
import { redactSecrets } from "@/lib/redact";

function recordAudit(args: {
  userId: string;
  provider: string;
  tool: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}) {
  getServiceClient()
    .from("daemoon_audit")
    .insert({
      user_id: args.userId,
      provider: args.provider,
      tool: args.tool,
      ok: args.ok,
      error: args.error ?? null,
      duration_ms: args.durationMs,
    })
    .then(
      () => {},
      () => {},
    );
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const raw = auth.slice(7).trim();
    const uid = await lookupPat(raw);
    if (uid) return uid;
  }
  try {
    return await requireUserId();
  } catch {
    return null;
  }
}

function checkOrigin(req: NextRequest, isPat: boolean): boolean {
  if (isPat) return true; // PAT auth is origin-agnostic
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server or no-cors (same-origin fetch sends no Origin)
  const allowed = new URL("https://daemoon.dev").origin;
  try {
    return new URL(origin).origin === allowed;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const isPat = !!auth?.startsWith("Bearer ");
    if (!checkOrigin(req, isPat)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }
    const userId = await resolveUserId(req);
    if (!userId) {
      // RFC 9728: tell OAuth-aware clients where to find Protected Resource Metadata.
      return NextResponse.json(
        { error: "unauthenticated" },
        {
          status: 401,
          headers: {
            "www-authenticate":
              'Bearer realm="https://daemoon.dev", resource_metadata="https://daemoon.dev/.well-known/oauth-protected-resource"',
          },
        },
      );
    }
    const body = await req.json();
    const method = body?.method as string | undefined;

    if (method === "tools/list") {
      const tools = listConnectors().flatMap(c =>
        c.tools.map(t => ({
          name: t.name,
          description: `[${c.label}] ${t.description}`,
          inputSchema: t.inputSchema,
        })),
      );
      return NextResponse.json({ result: { tools } });
    }

    if (method === "tools/call") {
      const name = body?.params?.name as string | undefined;
      const args = (body?.params?.arguments ?? {}) as Record<string, unknown>;
      if (!name) return NextResponse.json({ error: "missing params.name" }, { status: 400 });
      const [providerId] = name.split(".");
      let connector;
      try {
        connector = getConnector(providerId);
      } catch {
        return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 404 });
      }
      const tool = connector.tools.find(t => t.name === name);
      if (!tool) return NextResponse.json({ error: `Tool not found: ${name}` }, { status: 404 });
      const stored = await loadToken(userId, providerId);
      const ctx: ToolContext = { token: stored?.token ?? null, userId };
      const t0 = Date.now();
      try {
        const result = await tool.handler(args, ctx);
        recordAudit({ userId, provider: providerId, tool: name, ok: true, durationMs: Date.now() - t0 });
        return NextResponse.json({ result });
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const msg = redactSecrets(raw);
        recordAudit({ userId, provider: providerId, tool: name, ok: false, error: msg, durationMs: Date.now() - t0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "unknown method" }, { status: 400 });
  } catch (e) {
    const msg = redactSecrets(e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
