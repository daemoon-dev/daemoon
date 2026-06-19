/* Next.js middleware — Supabase session refresh.
 *
 * Runs *cookie-based session refresh* on every request → expired tokens auto-refresh.
 * Auth-gating redirects happen at the page/route level (this middleware *only keeps the session alive*).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value, options } of toSet) {
            req.cookies.set(name, value);
            res = NextResponse.next({ request: req });
            res.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  await sb.auth.getUser();
  return res;
}

export const config = {
  matcher: [
    /* Match all paths except static files, favicon, and image assets. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
