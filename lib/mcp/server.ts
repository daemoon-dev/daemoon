/* Daemoon MCP server.
 *
 * Single endpoint that AI agents call, built on the standard MCP SDK.
 *
 * Tool naming: "<provider>.<action>" — exposed exactly as the connector defines.
 *   e.g. vercel.list_projects / vercel.create_project / vercel.deploy
 *
 * Auth: each MCP call carries a *user identity token* (env var DAEMOON_USER_TOKEN
 *       or a custom MCP transport header). That token is used to pull the provider
 *       token out of the vault.
 *
 * Security:
 *   - Provider tokens *never appear in MCP responses* — only tool results.
 *   - Every call should be audit-logged (Supabase, separate table) — Phase 2.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pkg from "../../package.json" with { type: "json" };
import { listConnectors, getConnector } from "../connectors/registry";
import { loadToken } from "../vault/store";
import type { ToolContext } from "../connectors/types";

interface DaemoonMcpOptions {
  /** Caller's Daemoon user id — vault key. */
  userId: string;
}

export function createDaemoonMcpServer(opts: DaemoonMcpOptions): Server {
  const server = new Server(
    { name: "daemoon", version: pkg.version },
    { capabilities: { tools: {} } },
  );

  // tools/list — flatten tools across all connectors
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

  // tools/call — resolve provider → fetch vault token → run handler
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

/** Run over stdio (used when Claude Code etc. spawns the server directly). */
export async function runStdio(userId: string): Promise<void> {
  const server = createDaemoonMcpServer({ userId });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
