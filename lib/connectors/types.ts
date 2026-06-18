/* Daemoon — provider connector base types.
 *
 * 모든 provider (Vercel, Cloudflare, GitHub, Supabase, ...) 는 이 interface 를 따른다.
 * 같은 shape 라서 MCP server 가 동적으로 등록한다.
 *
 * Connector 정의는 *순수 함수 모음* 으로 작성:
 *   - oauth.start / oauth.exchange : OAuth 흐름
 *   - tools : agent 가 호출 가능한 액션 (예: vercel.deploy)
 *
 * Connector 는 token 을 *직접 저장하지 않음*. token 은 항상 vault 가 보관.
 * 호출 시 vault 에서 꺼낸 token 을 connector 함수에 *인자로 전달*.
 *
 * 이로써:
 *   - Connector = stateless (open source 안전)
 *   - Vault    = stateful (Daemoon 내부, 비공개)
 */

export type JsonSchema = Record<string, unknown>;

export interface ToolDef<I = unknown, O = unknown> {
  /** "vercel.create_project" 같은 도구 이름 (MCP namespace). */
  name: string;
  /** 사람이 읽을 한 줄 설명. */
  description: string;
  /** 입력 인자 JSON Schema. */
  inputSchema: JsonSchema;
  /** 실행 핸들러. token 은 vault 가 주입. */
  handler: (args: I, ctx: ToolContext) => Promise<O>;
}

export interface ToolContext {
  /** 호출자의 token (provider 별). null 이면 connector 가 unauthorized 응답해야 함. */
  token: string | null;
  /** 호출하는 user id (감사 로그용). */
  userId: string;
  /** Daemoon 내부 옵션 (rate-limit / region 등). */
  options?: Record<string, unknown>;
}

export interface OAuthStart {
  /** 사용자가 새 탭에서 열어야 할 provider 의 authorize URL. */
  authorizeUrl: string;
  /** Daemoon 가 callback 검증할 때 비교할 state 값. */
  state: string;
}

export interface OAuthExchanged {
  /** 발급된 access token (vault 에 저장됨). */
  token: string;
  /** 만료까지 초 (없으면 영구). */
  expiresIn?: number;
  /** refresh_token (가능하면). */
  refreshToken?: string;
  /** provider 측 user 식별자 (감사용). */
  providerUserId?: string;
  /** 부수 메타 (계정 이름 등 UI 표시용). */
  meta?: Record<string, unknown>;
}

export interface Connector {
  /** "vercel", "cloudflare", "github", "supabase" — 고유 id. */
  id: string;
  /** UI 표기명. */
  label: string;
  /** OAuth 가능 여부. false 면 PAT 입력 받음 (Cloudflare 등). */
  oauthSupported: boolean;
  /** OAuth 흐름 시작 — authorize URL 반환. */
  oauthStart?(redirectUri: string, state: string): OAuthStart;
  /** OAuth callback — code → token 교환. */
  oauthExchange?(code: string, redirectUri: string): Promise<OAuthExchanged>;
  /** PAT 직접 받는 connector 용 — 토큰 유효성 검증. */
  validatePat?(pat: string): Promise<{ ok: true; meta?: Record<string, unknown> } | { ok: false; reason: string }>;
  /** MCP 가 expose 할 도구들.
   *
   * 의도적으로 `any` — connector 마다 입출력 타입 다른 ToolDef 를 한 배열에 담아야 하므로.
   * 외부에서 도구 호출 시점에 handler 가 자기 타입을 알고 있어 안전.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: ToolDef<any, any>[];
}
