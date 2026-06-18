/* POST /api/pat — create new PAT for current user.
 *   body: { label?: string }
 *   200: { raw: "dmn_...", prefix: "dmn_abc1..." }  (raw shown once)
 *
 * GET /api/pat — list current user's PATs (no raw).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUserId, getServerSupabase } from "@/lib/auth";
import { createPat } from "@/lib/pat";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const label = (body?.label as string | undefined)?.trim() || null;
    const { raw, prefix } = await createPat(userId, label ?? undefined);
    return NextResponse.json({ raw, prefix });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    await requireUserId();
    const sb = await getServerSupabase();
    const { data, error } = await sb.from("daemoon_my_pats").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ pats: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
