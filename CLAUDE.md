# Daemoon — Claude Code starter

## 무엇

대문 (大門) + Daemon. 비개발자를 위한 *AI dev infra gateway*.
사용자가 한 번 로그인 → AI 에이전트가 Cloudflare/GitHub/Vercel/Supabase 등 인프라 작업 대신 수행. 사용자는 결제만.

자세한 정보: [SPEC.md](./SPEC.md)

## 작업 디렉토리

`/Users/descartes/daemoon/` — 본 프로젝트. Bible (TheSudoku) / Posy 등 별개.

## Stack

- Next.js 15 App Router + TypeScript + Tailwind
- Supabase (DB + auth)
- @modelcontextprotocol/sdk (MCP server)
- 배포: Vercel (icn1 region — 한국 사용자 대응 + 글로벌 영어 first)

## Folder

```
/Users/descartes/daemoon/
  app/                 # Next.js App Router
  lib/                 # shared utils + Supabase client + provider connectors
  mcp/                 # MCP server (별도 entrypoint, npm script로 실행)
  SPEC.md              # 본 프로젝트 정의서
  CLAUDE.md            # 이 파일
```

## MVP 4 Provider

1. Cloudflare — 도메인 + DNS
2. GitHub — 코드 저장 + 버전 관리
3. Vercel — 배포
4. Supabase — DB + auth

## 결정 요약 (SPEC §9)

- 회원가입: Google OAuth 단일
- 도메인: daemoon.ai + daemoon.dev 둘 다
- 가격: 베타 무료
- 오픈소스: open core (MCP + connectors 공개, vault/UX/billing 비공개)
- 첫 시장: 글로벌 영어
- 코드 hosting: GitHub private repo 로 시작

## 보안 룰

- Token vault: per-user 격리, AES-256 envelope encryption + Supabase KMS key
- MCP server 코드에 token 절대 hard-code X
- 모든 provider 호출은 사용자 token 으로만 (시스템 master token 사용 X)
