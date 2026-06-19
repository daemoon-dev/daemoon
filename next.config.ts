import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // OAuth 2.0 discovery — Next.js can't host pages under dot-folders directly,
      // so we rewrite from /.well-known/* to /well-known/* route handlers.
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/well-known/oauth-authorization-server",
      },
      // Resource-path-specific variants used by some MCP clients (e.g., Smithery).
      {
        source: "/.well-known/oauth-protected-resource/api/mcp",
        destination: "/well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server/api/mcp",
        destination: "/well-known/oauth-authorization-server",
      },
    ];
  },
};

export default nextConfig;
