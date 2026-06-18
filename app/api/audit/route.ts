/* GET /api/audit — last 5 audit rows for current user. */
import { NextResponse } from "next/server";
import { requireUserId, getServerSupabase } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireUserId();
    const sb = await getServerSupabase();
    const { data, error } = await sb
      .from("daemoon_my_audit")
      .select("id, provider, tool, ok, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
