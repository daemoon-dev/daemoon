# Daemoon — SPEC v0

> 대문 (大門) + Daemon. AI 시대의 dev infra gateway.
> 작성: 2026-06-17 KST · 작성자: Jenny + Claude

---

## 1. Vision

> **사용자는 단 한 번 로그인한다. 그 후로 AI 가 모든 인프라 작업의 손이 된다. 사용자는 결제만 한다.**

지금 비개발자가 AI 코딩 도구 (Claude Code / Cursor / Bolt 등) 로 앱을 만들려면 매번:
- Cloudflare 가서 토큰 만들어와 / Vercel CLI 로그인 / Supabase PAT 발급 / Google Cloud Console 깊은 메뉴 헤매기

→ Daemoon 은 *이 모든 인프라 접근* 을 한 번에 열어주는 *AI agent용 gateway*.

---

## 2. Problem (지금 painful 한 것)

1. AI 코딩 에이전트가 \"Cloudflare DNS 바꿀게\" 라고 하면 → 사용자가 dashboard 가서 token 만들어와야 함
2. 토큰 만드는 위치 외울 수 없음 (서비스마다 다 다른 메뉴/이름/스코프)
3. 비개발자는 토큰 권한 (read/write/admin) 결정 못함
4. 만든 token 안전한 곳에 보관할 줄 모름
5. 토큰 만료/회전 되면 다시 헤맴
6. 새 서비스 (Supabase / Resend / Sentry) 추가할 때마다 위 과정 반복

→ 결과: \"AI 가 만들어주는 시대\" 인데 *사용자가 실제로 만지는 admin console 시간이 코딩보다 더 김*.

---

## 3. Target user

- **Persona A**: 비개발 창업자/PM. 아이디어 있고 Claude Code/Bolt 같은 거 좋아하지만 토큰 paste 단계에서 \"이건 내 일이 아니지\" 답답함
- **Persona B**: 1인 개발자/사이드프로젝터. 토큰 관리 귀찮음
- **Persona C (간접)**: AI 코딩 에이전트 자체 — 사용자한테 \"이거 토큰 줘\" 안 묻고 자기가 알아서 끝내고 싶음

언제 우리를 찾는가:
- Claude Code/Cursor 에서 \"Vercel 배포해줘\" 처음 시도할 때 토큰 paste 좌절
- 도메인 사라고 했는데 등록업체 가입부터 막힘

---

## 4. Aha demo (5분 안에 사용자가 보는 마법)

```
사용자: \"내 첫 앱 만들어줘. 도메인 이름은 mycoolapp.com\"
AI:
  • Daemoon 통해 도메인 \$15 결제 요청 → 사용자가 카드 정보 1번 → 구매 완료
  • Daemoon 통해 GitHub repo 생성 (Next.js boilerplate)
  • Daemoon 통해 Supabase 프로젝트 만들고 DB schema 깔기
  • Daemoon 통해 Vercel 프로젝트 + 도메인 연결 + 배포
  • Cloudflare DNS 설정
  • 5분 후 → \"https://mycoolapp.com 라이브.\"
```

= 사용자는 Cloudflare/Vercel/Supabase 이름도 모름. *AI 가 다 알아서.*

---

## 5. MVP scope

### Provider 4개 (필수, 이 순서로 통합)
1. **Cloudflare** — 도메인 구매 + DNS
2. **GitHub** — 코드 저장 + 버전 관리
3. **Vercel** — 빌드 + 배포
4. **Supabase** — DB + auth

### Daemoon 구성요소
1. **MCP server** (TS, 표준 Anthropic MCP SDK) — agent 가 부르는 입구
2. **Provider connectors** — 각 service OAuth/PAT 받아 wrap + 표준 인터페이스 노출
3. **Token vault** — 암호화 (Supabase + KMS), per-user 스코프 격리
4. **사용자 web 앱** — 로그인 + connect 버튼 + 진행상황 보여주는 stream UI

### MVP 안에 결제? — **X**
- 도메인 살 때만 사용자에게 \"이 카드로 결제\" 외부 링크 띄움 (Cloudflare Registrar 결제 페이지)
- Daemoon 자체 구독/사용량 과금은 Phase 2

### MVP 사용자 언어
- 한국어 + 영어 (i18n 처음부터)

---

## 6. Tech stack

| Layer | Choice | 이유 |
|---|---|---|
| Web | Next.js 15 (App Router) | Vercel 친화, server actions |
| DB / Auth | Supabase | 우리도 dogfooding |
| MCP server | TS, @modelcontextprotocol/sdk | 표준 SDK |
| Hosting | Vercel | 자명 |
| 결제 (Phase 2) | Stripe Connect | MoR 리스크 회피 |
| Token vault | Supabase + envelope encryption (AES-256 + KMS key) | per-user 격리 |

배포 자체도 Daemoon 으로 — *bootstrap inception*.

---

## 7. Non-goals (MVP에서 *안* 하는 것)

- 결제/구독 (외부 결제 redirect 만)
- Stripe / Resend / Sentry / PostHog 같은 Phase 2 provider
- 50+ provider 카탈로그 (4개 깊이가 우선)
- Enterprise SSO / SOC2 / GDPR Auditor 인증
- 자체 호스팅 옵션 / on-prem
- 한국 외 결제 (USD 만 — 단순)
- 모바일 앱 (web 만)

---

## 8. Success metrics (MVP 출시 후 30일)

1. *Activation*: 첫 가입 후 *5분 내* \"내 앱 라이브\" 까지 도달한 사용자 비율 ≥ 60%
2. *Retention*: 가입 7일 후 다시 들어와서 *2번째 앱* 만들기 시작한 사용자 ≥ 20%
3. *Agent adoption*: MCP registry 등록 후 30일 내 *Claude Code/Cursor 외부 사용자* 연결 시도 ≥ 50회
4. *Bug*: 사용자가 토큰 paste 단계 좌절로 churn = 0건 (= UX 깔끔)

---

## 9. Decisions (Jenny 확정 2026-06-17)

| # | 질문 | 결정 |
|---|---|---|
| Q1 | 사용자 회원가입 방식 | **Google OAuth 단일** (Kakao X — 글로벌이므로) |
| Q2 | 도메인 | **daemoon.ai + daemoon.dev 둘 다** (내일 구매) |
| Q3 | 코드명 | **Daemoon** 확정 (브랜드명 동일) |
| Q4 | MVP launch 타깃 | TBD (만들어가며 결정) |
| Q5 | 가격 | **베타 무료** (Phase 2 에서 결정) |
| Q6 | open source | **open core** — MCP server + provider connectors 공개 / hosted vault + UX + 결제 비공개 |
| Q7 | 첫 시장 | **글로벌 영어 first** |
| Q8 | 마케팅 wedge | TBD — MVP 완성도 우선, 마케팅 카피는 나중 |

---

## 10. Next steps (이 spec 확정 후)

1. Q1-8 Jenny 결정 → 위 표 채우기
2. \`/Users/descartes/daemoon/\` 에 Next.js boilerplate setup
3. Daemoon 자체용 Supabase 프로젝트 신규 (다른 ref)
4. Daemoon 자체용 Vercel 프로젝트 신규
5. Daemoon 자체용 GitHub repo (private 시작)
6. *Provider 1 = Vercel connector* 부터 (가장 OAuth 친화) → 1주 안에 \"AI가 Vercel 배포\" 동작
7. Provider 2-4 1주씩 → MVP 4주 안에
