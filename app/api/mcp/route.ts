/* HTTP MCP endpoint — Claude Code / Cursor 등이 호출.
 *
 * 인증:
 *   1) `Authorization: Bearer dmn_xxx` (PAT)  → MCP client 용 (주된 경로)
 *   2) 세션 쿠키 → 로그인된 브라우저 호출 (대시보드 디버그용)
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
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function recordAudit(args: {
  userId: string;
  provider: string;
  tool: string;
  ok: boolean;
  error?: string;
  durationMs: number;
}) {
  serviceClient().from("daemoon_audit").insert({
    user_id: args.userId,
    provider: args.provider,
    tool: args.tool,
    ok: args.ok,
    error: args.error ?? null,
    duration_ms: args.durationMs,
  }).then(() => {});
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
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
      const connector = getConnector(providerId);
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
        const msg = e instanceof Error ? e.message : String(e);
        recordAudit({ userId, provider: providerId, tool: name, ok: false, error: msg, durationMs: Date.now() - t0 });
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "unknown method" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
