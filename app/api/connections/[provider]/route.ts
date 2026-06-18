/* DELETE /api/connections/<provider> — disconnect a connected provider. */
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deleteToken } from "@/lib/vault/store";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { provider } = await context.params;
    await deleteToken(userId, provider);
    return NextResponse.json({ ok: true, provider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
