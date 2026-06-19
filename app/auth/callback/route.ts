/* OAuth + email-link callback.
 *
 *   GET /auth/callback?code=...      ← PKCE / OAuth
 *   GET /auth/callback?token_hash=...&type=magiclink  ← email magic link
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await getServerSupabase();
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  // Open-redirect-safe: must start with single `/`, no `//`.
  const rawNext = url.searchParams.get("next") || "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  try {
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && type) {
      const { error } = await sb.auth.verifyOtp({
        type: type as "magiclink" | "recovery" | "invite" | "email_change",
        token_hash: tokenHash,
      });
      if (error) throw error;
    } else {
      return NextResponse.redirect(new URL("/?error=missing_params", req.url));
    }
    return NextResponse.redirect(new URL(next, req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(msg)}`, req.url));
  }
}
