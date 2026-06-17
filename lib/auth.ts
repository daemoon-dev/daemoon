/* Daemun — server-side Supabase auth helper.
 *
 * Next.js App Router (route handlers / server actions) 에서 호출.
 * @supabase/ssr 의 createServerClient 로 cookie 동기화.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        for (const { name, value, options } of toSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

export async function requireUserId(): Promise<string> {
  const sb = await getServerSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHENTICATED");
  return data.user.id;
}
