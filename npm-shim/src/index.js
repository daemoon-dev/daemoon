#!/usr/bin/env node
/* Daemoon MCP stdio shim — proxies stdio MCP traffic to https://daemoon.dev/api/mcp.
 *
 * Usage (Claude Code config):
 *   {
 *     "mcpServers": {
 *       "daemoon": {
 *         "command": "npx",
 *         "args": ["-y", "daemoon-mcp"],
 *         "env": { "DAEMOON_TOKEN": "dmn_..." }
 *       }
 *     }
 *   }
 *
 * Generate DAEMOON_TOKEN at https://daemoon.dev/dashboard.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ENDPOINT = process.env.DAEMOON_ENDPOINT || "https://daemoon.dev/api/mcp";
const TOKEN = process.env.DAEMOON_TOKEN;

if (!TOKEN) {
  console.error(
    "DAEMOON_TOKEN env var is required. Generate one at https://daemoon.dev/dashboard.",
  );
  process.exit(1);
}

const VERSION = "1.0.0";

async function call(method, params) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": `daemoon-mcp/${VERSION}`,
    },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Daemoon ${method} ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`Daemoon ${method}: ${data.error}`);
  }
  return data.result;
}

async function main() {
  const server = new Server(
    { name: "daemoon", version: VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const result = await call("tools/list", {});
    return result;
  });

  server.setRequestHandler(CallToolRequestSchema, async req => {
    try {
      const result = await call("tools/call", req.params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: e.message }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error("daemoon-mcp crashed:", err);
  process.exit(1);
});
