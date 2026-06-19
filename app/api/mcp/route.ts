/* HTTP MCP endpoint — JSON-RPC 2.0 over POST (MCP Streamable HTTP).
 *
 * Auth:
 *   1) `Authorization: Bearer dmn_xxx` (PAT) → primary path for MCP clients
 *   2) Session cookie → logged-in browser calls (for dashboard debugging)
 *
 * Supports: initialize, notifications/initialized, tools/list, tools/call, ping.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { lookupPat } from "@/lib/pat";
import { getConnector, listConnectors } from "@/lib/connectors/registry";
import { loadToken } from "@/lib/vault/store";
import type { ToolContext } from "@/lib/connectors/types";
import { getServiceClient } from "@/lib/supabase/service";
import { redactSecrets } from "@/lib/redact";
import pkg from "../../../package.json" with { type: "json" };

const PROTOCOL_VERSION = "2025-06-18";

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
  if (isPat) return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const allowed = new URL("https://daemoon.dev").origin;
  try {
    return new URL(origin).origin === allowed;
  } catch {
    return false;
  }
}

function rpcResult(id: unknown, result: unknown): NextResponse {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string, status = 200): NextResponse {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status },
  );
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

async function handleRpc(body: JsonRpcRequest, userId: string): Promise<NextResponse> {
  const { id = null, method, params = {} } = body;

  switch (method) {
    case "initialize": {
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "daemoon", version: pkg.version },
      });
    }

    case "notifications/initialized":
    case "initialized": {
      // Notifications expect no response body for null id, but we return 202.
      return new NextResponse(null, { status: 202 });
    }

    case "ping": {
      return rpcResult(id, {});
    }

    case "tools/list": {
      const tools = listConnectors().flatMap(c =>
        c.tools.map(t => ({
          name: t.name,
          description: `[${c.label}] ${t.description}`,
          inputSchema: t.inputSchema,
        })),
      );
      return rpcResult(id, { tools });
    }

    case "tools/call": {
      const name = (params.name as string | undefined);
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      if (!name) return rpcError(id, -32602, "missing params.name");
      const [providerId] = name.split(".");
      let connector;
      try {
        connector = getConnector(providerId);
      } catch {
        return rpcError(id, -32601, `Unknown provider: ${providerId}`);
      }
      const tool = connector.tools.find(t => t.name === name);
      if (!tool) return rpcError(id, -32601, `Tool not found: ${name}`);
      const stored = await loadToken(userId, providerId);
      const ctx: ToolContext = { token: stored?.token ?? null, userId };
      const t0 = Date.now();
      try {
        const result = await tool.handler(args, ctx);
        recordAudit({ userId, provider: providerId, tool: name, ok: true, durationMs: Date.now() - t0 });
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const msg = redactSecrets(raw);
        recordAudit({ userId, provider: providerId, tool: name, ok: false, error: msg, durationMs: Date.now() - t0 });
        return rpcResult(id, {
          content: [{ type: "text", text: msg }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method ?? "<none>"}`);
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
      // RFC 9728 — point OAuth-aware clients at Protected Resource Metadata.
      return NextResponse.json(
        { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthenticated" } },
        {
          status: 401,
          headers: {
            "www-authenticate":
              'Bearer realm="https://daemoon.dev", resource_metadata="https://daemoon.dev/.well-known/oauth-protected-resource", scope="mcp"',
          },
        },
      );
    }
    const body = (await req.json()) as JsonRpcRequest;
    return await handleRpc(body, userId);
  } catch (e) {
    const msg = redactSecrets(e instanceof Error ? e.message : String(e));
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: msg } },
      { status: 500 },
    );
  }
}

// MCP Streamable HTTP transport: GET opens an SSE channel. We're not pushing
// server-initiated events yet, so respond with 405 (HTTP POST only).
export function GET(): NextResponse {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32601, message: "GET not supported; use POST" } },
    { status: 405, headers: { allow: "POST" } },
  );
}
