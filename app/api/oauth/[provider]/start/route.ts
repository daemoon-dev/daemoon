/* OAuth start — 동적 provider routing.
 *
 *   GET /api/oauth/vercel/start?return=/dashboard
 *
 *   → connector.oauthStart 호출 → state 발급 (cookie 저장) → 302 to authorize_url
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getConnector } from "@/lib/connectors/registry";
import { requireUserId } from "@/lib/auth";

const STATE_COOKIE = "daemun_oauth_state";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { provider } = await context.params;
    const connector = getConnector(provider);
    if (!connector.oauthSupported || !connector.oauthStart) {
      return NextResponse.json({ error: "OAuth not supported for this provider" }, { status: 400 });
    }
    const redirectUri = new URL(`/api/oauth/${provider}/callback`, req.url).toString();
    const stateVal = `${userId}.${randomBytes(16).toString("hex")}`;
    const { authorizeUrl } = connector.oauthStart(redirectUri, stateVal);
    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set(STATE_COOKIE, stateVal, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
