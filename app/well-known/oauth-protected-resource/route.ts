/* OAuth 2.0 Protected Resource Metadata (RFC 9728).
 * Lets MCP clients discover how to obtain a Bearer token. */
import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  return NextResponse.json(
    {
      resource: "https://daemoon.dev/api/mcp",
      authorization_servers: ["https://daemoon.dev"],
      bearer_methods_supported: ["header"],
      resource_documentation: "https://daemoon.dev/dashboard",
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
