# daemoon-mcp

Stdio MCP shim for [Daemoon](https://daemoon.dev) — one Bearer token gives any
MCP-aware AI agent access to Vercel, GitHub, Cloudflare, Supabase, Google Cloud,
Stripe, Resend, OpenAI, and Anthropic.

## Install

```bash
npx -y daemoon-mcp
```

## Usage

Generate a Daemoon token at https://daemoon.dev/dashboard, then drop into your
agent's MCP config:

### Claude Code

```bash
claude mcp add daemoon --command "npx" --args "-y,daemoon-mcp" --env "DAEMOON_TOKEN=dmn_..."
```

Or paste into `~/.claude.json`:

```json
{
  "mcpServers": {
    "daemoon": {
      "command": "npx",
      "args": ["-y", "daemoon-mcp"],
      "env": { "DAEMOON_TOKEN": "dmn_..." }
    }
  }
}
```

### Cursor

`Settings → MCP → Add new server`:

```json
{
  "daemoon": {
    "command": "npx",
    "args": ["-y", "daemoon-mcp"],
    "env": { "DAEMOON_TOKEN": "dmn_..." }
  }
}
```

## What it does

`daemoon-mcp` is a tiny stdio→HTTP shim. The actual tools live at
`https://daemoon.dev/api/mcp`. The token in `DAEMOON_TOKEN` authenticates each
call to your Daemoon vault — the agent never sees the underlying provider
credentials.

18 tools across 9 providers:

- `vercel.list_projects`, `vercel.create_project`, `vercel.create_deployment`
- `github.list_repos`, `github.create_repo`
- `supabase.list_projects`, `supabase.run_sql`
- `cloudflare.list_zones`, `cloudflare.create_dns_record`
- `gcp.list_projects`, `gcp.list_services`
- `stripe.list_products`, `stripe.list_customers`, `stripe.create_payment_link`
- `resend.send_email`, `resend.list_domains`
- `openai.list_models`, `openai.chat_completion`
- `anthropic.create_message`

## Configuration

| Env var            | Default                                | Description                                  |
|--------------------|----------------------------------------|----------------------------------------------|
| `DAEMOON_TOKEN`    | — (required)                           | PAT generated at daemoon.dev/dashboard       |
| `DAEMOON_ENDPOINT` | `https://daemoon.dev/api/mcp`          | Override for self-hosted Daemoon             |

## License

MIT. Source: https://github.com/daemoon-dev/daemoon
