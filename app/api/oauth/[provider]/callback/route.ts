/* OAuth callback — exchange code for token → store in vault → redirect to /dashboard.
 *
 *   GET /api/oauth/vercel/callback?code=...&state=...
 */
import { NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/registry";
import { requireUserId } from "@/lib/auth";
import { saveToken } from "@/lib/vault/store";

const STATE_COOKIE = "daemoon_oauth_state";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { provider } = await context.params;
    const connector = getConnector(provider);
    if (!connector.oauthExchange) {
      return NextResponse.json({ error: "OAuth exchange not supported" }, { status: 400 });
    }
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const stored = req.cookies.get(STATE_COOKIE)?.value;
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
    if (!state || state !== stored) {
      return NextResponse.json({ error: "state mismatch — possible CSRF" }, { status: 400 });
    }
    // Also verify the state's prefix is the caller's own userId.
    const [statedUserId] = state.split(".");
    if (statedUserId !== userId) {
      return NextResponse.json({ error: "user mismatch" }, { status: 403 });
    }

    const redirectUri = new URL(`/api/oauth/${provider}/callback`, req.url).toString();
    const exchanged = await connector.oauthExchange(code, redirectUri);
    await saveToken(userId, provider, {
      token: exchanged.token,
      refreshToken: exchanged.refreshToken,
      expiresAt: exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000) : undefined,
      providerUserId: exchanged.providerUserId,
      meta: exchanged.meta,
    });

    const res = NextResponse.redirect(new URL("/dashboard?connected=" + provider, req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
