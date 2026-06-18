/* POST /api/signout — sign out the current session. */
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const sb = await getServerSupabase();
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
