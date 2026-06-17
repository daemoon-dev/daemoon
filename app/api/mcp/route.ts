/* HTTP-friendly MCP tools endpoint (간단 JSON-RPC 흉내).
 *
 * Claude Code 가 표준 MCP stdio 가 아닌 *HTTP MCP* 로 호출할 때 쓰는 변형.
 * 본격적인 streaming MCP 는 별 transport 깔지만, MVP 에선 단발 POST 로 충분.
 *
 * POST /api/mcp
 * {
 *   "method": "tools/list" | "tools/call",
 *   "params": { name: "vercel.list_projects", arguments: {...} }
 * }
 *
 * 인증: Daemun 사용자 *세션 쿠키* (브라우저) 또는 *PAT 헤더* `Authorization: Bearer dmn_xxx`
 *       MVP 는 세션만, PAT 는 Phase 2.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getConnector, listConnectors } from "@/lib/connectors/registry";
import { loadToken } from "@/lib/vault/store";
import type { ToolContext } from "@/lib/connectors/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
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
      const result = await tool.handler(args, ctx);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "unknown method" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
