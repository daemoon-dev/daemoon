/* Daemoon MCP server.
 *
 * MCP 표준 SDK 위에서 *AI 에이전트가 호출하는 단일 endpoint*.
 *
 * Tool naming: "<provider>.<action>" — connector 가 정의한 그대로 expose.
 *   예: vercel.list_projects / vercel.create_project / vercel.deploy
 *
 * 인증: MCP 호출 시 Daemoon 가 *사용자 식별 토큰* 을 받음 (env var DAEMOON_USER_TOKEN
 *       또는 MCP transport 의 custom header). 해당 토큰으로 vault 에서 provider token 꺼냄.
 *
 * 보안:
 *   - provider token 은 *절대 MCP 응답에 포함 X* — 도구 결과만 반환
 *   - 모든 호출 → audit log (Supabase, 별도 테이블) 권장 (Phase 2)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pkg from "../../package.json" with { type: "json" };
import { listConnectors, getConnector } from "../connectors/registry";
import { loadToken } from "../vault/store";
import type { ToolContext } from "../connectors/types";

interface DaemoonMcpOptions {
  /** 호출자의 Daemoon 사용자 id — vault key. */
  userId: string;
}

export function createDaemoonMcpServer(opts: DaemoonMcpOptions): Server {
  const server = new Server(
    { name: "daemoon", version: pkg.version },
    { capabilities: { tools: {} } },
  );

  // tools/list — 모든 connector 의 도구 평탄화
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = listConnectors().flatMap(c =>
      c.tools.map(t => ({
        name: t.name,
        description: `[${c.label}] ${t.description}`,
        inputSchema: t.inputSchema,
      })),
    );
    return { tools };
  });

  // tools/call — provider 식별 → vault token → handler
  server.setRequestHandler(CallToolRequestSchema, async req => {
    const [providerId] = req.params.name.split(".");
    const connector = getConnector(providerId);
    const tool = connector.tools.find(t => t.name === req.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool not found: ${req.params.name}` }],
        isError: true,
      };
    }
    const stored = await loadToken(opts.userId, providerId);
    const ctx: ToolContext = {
      token: stored?.token ?? null,
      userId: opts.userId,
    };
    try {
      const out = await tool.handler(req.params.arguments ?? {}, ctx);
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  });

  return server;
}

/** stdio 모드로 실행 (Claude Code 등이 직접 spawn 할 때). */
export async function runStdio(userId: string): Promise<void> {
  const server = createDaemoonMcpServer({ userId });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
