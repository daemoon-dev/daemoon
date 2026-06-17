/* Next.js middleware — Supabase session refresh.
 *
 * 모든 요청에 *cookie 기반 세션 갱신* 실행 → 만료 토큰 자동 refresh.
 * Auth 강제 redirect 는 페이지/route 단에서 (이 미들웨어는 *session 살아있게만*).
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
    /* 정적 파일 + favicon + API/oauth 외 모든 path 매치. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
