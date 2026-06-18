/* DELETE /api/pat/<id> — revoke a PAT (owner only). */
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const { error } = await service()
      .from("daemoon_pats")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
