# Daemoon

**One login. Every infrastructure. Built for AI coding agents.**

[daemoon.dev](https://daemoon.dev) · MCP server · Vercel · GitHub · Cloudflare · Supabase · GCP

---

Daemoon is the simplest way to give your AI coding agent (Claude Code, Cursor, etc.) access to all your dev infrastructure. Connect each provider **once** in your browser, then any agent gets unified, secure tool access via a single MCP token.

## Why

You're prototyping with Claude Code. The agent wants to deploy a Vercel project, create a Supabase table, push a GitHub branch. Today you paste five different tokens into five different config files — and every new agent / repo / teammate starts over.

Daemoon ends that. One sign-in connects everything. One token wires the agent.

```
[You]                                    [Daemoon]                   [Providers]
  │                                          │                            │
  ├── Sign in once (Google) ─────────────────▶                            │
  ├── Connect Vercel · GitHub · CF · Supabase ▶─── OAuth · PAT ───────────▶
  ├── Generate MCP token ────────────────────▶                            │
  │                                          │                            │
  ▼                                          ▼                            ▼
 Claude Code / Cursor / any MCP client ⇄ /api/mcp ⇄ vault ⇄ live provider APIs
```

## Install

Generate your token once at [daemoon.dev/dashboard](https://daemoon.dev/dashboard), then point your agent at `https://daemoon.dev/api/mcp` with header `Authorization: Bearer dmn_...`.

### Claude Code

Paste this in the Claude Code chat — Claude runs the install:

```
Install the Daemoon MCP server for me by running:
claude mcp add --transport http daemoon https://daemoon.dev/api/mcp --header "Authorization: Bearer dmn_..."
```

### Cursor

`Settings → MCP → Add server → HTTP`:
- URL: `https://daemoon.dev/api/mcp`
- Headers: `Authorization: Bearer dmn_...`

### Cline / Continue / Zed / any MCP client

Add an HTTP MCP server pointing at `https://daemoon.dev/api/mcp` with the bearer token header. Supports MCP Streamable HTTP (protocol `2025-06-18`) and OAuth 2.0 (DCR + PKCE) for clients that prefer it.

### Machine-readable

- `https://daemoon.dev/.well-known/mcp.json` — server card
- `https://daemoon.dev/llms.txt` — agent-readable summary
- `https://daemoon.dev/.well-known/oauth-protected-resource` — RFC 9728
- `https://daemoon.dev/.well-known/oauth-authorization-server` — RFC 8414

## Connected providers

| Provider     | Auth          | Sample tools                                   |
|--------------|---------------|------------------------------------------------|
| Vercel       | OAuth (1-click) | `vercel.list_projects`, `vercel.create_deployment` |
| GitHub       | OAuth (1-click) | `github.list_repos`, `github.create_repo`         |
| Supabase     | OAuth + PAT   | `supabase.list_projects`, `supabase.run_sql`     |
| Cloudflare   | PAT           | `cloudflare.list_zones`, `cloudflare.create_dns_record` |
| Google Cloud | Service Account JSON | `gcp.list_projects`, `gcp.list_services`   |
| Stripe       | PAT (Secret key) | `stripe.list_products`, `stripe.list_customers`, `stripe.create_payment_link` |
| Resend       | PAT           | `resend.send_email`, `resend.list_domains`       |
| OpenAI       | PAT           | `openai.list_models`, `openai.chat_completion`   |
| Anthropic    | PAT           | `anthropic.create_message`                       |

More providers (Linear · Sentry · PostHog · Neon · Upstash · …) on the roadmap. PRs welcome.

## How it's secure

- **Envelope encryption** — every provider token is wrapped with a per-token DEK, then by a master key. AES-256-GCM end to end.
- **No raw secrets in your repo, no env vars to leak.** Tokens live in the Daemoon vault; the agent never sees them, only the responses.
- **Revoke any token in one click.** Per-provider disconnect, per-agent PAT revoke.

## Self-host

Daemoon is open-source. Clone, set env vars, deploy to your own Vercel:

```bash
git clone https://github.com/daemoon-dev/daemoon
cd daemoon
cp .env.local.example .env.local   # add your Supabase + provider OAuth creds
npm install
npm run dev
```

Schema in [`sql/0001_init.sql`](sql/0001_init.sql).

## Architecture

- **Next.js 15** App Router on Vercel (`icn1` region).
- **Supabase** for auth (Google + magic link) + Postgres vault.
- **MCP HTTP transport** at `/api/mcp` — JSON-RPC `tools/list` + `tools/call`.
- **Connector interface** in [`lib/connectors/types.ts`](lib/connectors/types.ts): every provider implements OAuth / PAT validation + a list of tool defs. Adding a provider is one file.

## Roadmap

- More connectors: Stripe, Resend, Linear, Notion, Plausible
- 1-click GitHub OAuth verified app (currently in Google Cloud "Testing" mode)
- Service Account JSON → OAuth for GCP (when verified)
- npm shim `daemoon-mcp` for stdio MCP clients

## License

MIT. See [LICENSE](LICENSE).
