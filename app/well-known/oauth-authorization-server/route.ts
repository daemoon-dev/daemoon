/* OAuth 2.0 Authorization Server Metadata (RFC 8414). */
import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  return NextResponse.json(
    {
      issuer: "https://daemoon.dev",
      authorization_endpoint: "https://daemoon.dev/oauth/authorize",
      token_endpoint: "https://daemoon.dev/oauth/token",
      registration_endpoint: "https://daemoon.dev/oauth/register",
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp"],
      service_documentation: "https://daemoon.dev/dashboard",
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
