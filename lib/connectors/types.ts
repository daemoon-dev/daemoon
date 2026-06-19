/* Daemoon — provider connector base types.
 *
 * Every provider (Vercel, Cloudflare, GitHub, Supabase, ...) implements this
 * interface. The shared shape lets the MCP server register them dynamically.
 *
 * A connector is defined as a *set of pure functions*:
 *   - oauth.start / oauth.exchange : OAuth flow
 *   - tools : agent-callable actions (e.g. vercel.deploy)
 *
 * Connectors *never store tokens directly*. Tokens always live in the vault
 * and are *passed in as arguments* to connector functions at call time.
 *
 * As a result:
 *   - Connector = stateless (safe to open source)
 *   - Vault    = stateful (internal to Daemoon, private)
 */

export type JsonSchema = Record<string, unknown>;

export interface ToolDef<I = unknown, O = unknown> {
  /** Tool name like "vercel.create_project" (MCP namespace). */
  name: string;
  /** One-line human-readable description. */
  description: string;
  /** JSON Schema for input arguments. */
  inputSchema: JsonSchema;
  /** Execution handler. Token is injected by the vault. */
  handler: (args: I, ctx: ToolContext) => Promise<O>;
}

export interface ToolContext {
  /** Caller's token (per provider). If null, the connector must respond unauthorized. */
  token: string | null;
  /** Calling user id (for audit logs). */
  userId: string;
  /** Daemoon-internal options (rate-limit / region / etc). */
  options?: Record<string, unknown>;
}

export interface OAuthStart {
  /** The provider's authorize URL the user should open in a new tab. */
  authorizeUrl: string;
  /** State value Daemoon compares on the callback. */
  state: string;
}

export interface OAuthExchanged {
  /** Issued access token (stored in vault). */
  token: string;
  /** Seconds until expiry (omit if non-expiring). */
  expiresIn?: number;
  /** refresh_token if available. */
  refreshToken?: string;
  /** Provider-side user identifier (for audit). */
  providerUserId?: string;
  /** Side metadata (account name etc. for UI display). */
  meta?: Record<string, unknown>;
}

export interface Connector {
  /** Unique id: "vercel", "cloudflare", "github", "supabase". */
  id: string;
  /** UI display name. */
  label: string;
  /** Whether OAuth is supported. If false, accept a PAT instead (e.g. Cloudflare). */
  oauthSupported: boolean;
  /** Start the OAuth flow — returns the authorize URL. */
  oauthStart?(redirectUri: string, state: string): OAuthStart;
  /** OAuth callback — exchange code for token. */
  oauthExchange?(code: string, redirectUri: string): Promise<OAuthExchanged>;
  /** For PAT-only connectors — validate the token. */
  validatePat?(pat: string): Promise<{ ok: true; meta?: Record<string, unknown> } | { ok: false; reason: string }>;
  /** Tools exposed via MCP.
   *
   * Intentionally `any` — each connector ships ToolDefs with different I/O types
   * but they must share one array. At call time the handler knows its own types,
   * so it stays safe externally.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: ToolDef<any, any>[];
}
