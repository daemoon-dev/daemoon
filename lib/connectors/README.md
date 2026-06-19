# Daemoon Provider Connectors

Each folder is one provider:

- `vercel/`
- `github/`
- `cloudflare/`
- `supabase/`
- `gcp/`
- `stripe/`
- `resend/`
- `openai/`
- `anthropic/`

Every connector implements this interface:

```ts
export interface Connector {
  id: string;                       // 'cloudflare', 'github', ...
  label: string;                    // human-friendly name
  oauthSupported: boolean;
  oauthStart?(redirectUri, state): { authorizeUrl };
  oauthExchange?(code, redirectUri): Promise<{ token, ... }>;
  validatePat?(pat): Promise<{ ok: boolean; reason?: string; meta?: object }>;
  tools: ToolDef[];                 // actions the MCP server exposes
}
```

Connectors are stateless. Tokens are loaded from the vault and passed to
handlers via `ctx.token`. They never see the user's PAT directly.

This folder is the open-source surface of the gateway.
