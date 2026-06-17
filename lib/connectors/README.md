# Daemun Provider Connectors

각 폴더 = 한 provider:
- cloudflare/
- github/
- vercel/
- supabase/

각 connector 가 노출하는 interface:
```ts
export interface Connector {
  id: string                      // 'cloudflare', 'github', ...
  oauth?(state): { authorizeUrl } // OAuth 시작
  exchange?(code): { token }      // OAuth callback → token
  tools: ToolDef[]                // MCP 가 expose 할 액션 list
}
```

이 폴더 = open source 부분.
