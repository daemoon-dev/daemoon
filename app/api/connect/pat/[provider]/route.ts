/* PAT 직접 입력 connector 용 — Cloudflare / Supabase 등.
 *
 *   POST /api/connect/pat/cloudflare
 *   body: { token: "abc..." }
 *
 *   → connector.validatePat() → 성공이면 vault 저장.
 */
import { NextRequest, NextResponse } from "next/server";
import { getConnector } from "@/lib/connectors/registry";
import { requireUserId } from "@/lib/auth";
import { saveToken } from "@/lib/vault/store";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const userId = await requireUserId();
    const { provider } = await context.params;
    const connector = getConnector(provider);
    // v0.4 — PAT 도 OAuth-지원 connector 에 허용 (Vercel/GitHub 도 PAT 받음).
    if (!connector.validatePat) {
      return NextResponse.json({ error: "PAT input not supported for this provider" }, { status: 400 });
    }
    const body = await req.json();
    const token = (body?.token as string | undefined)?.trim();
    if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
    const result = await connector.validatePat(token);
    if (!result.ok) return NextResponse.json({ error: `Invalid: ${result.reason}` }, { status: 400 });
    await saveToken(userId, provider, { token, meta: result.meta });
    return NextResponse.json({ ok: true, provider });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "UNAUTHENTICATED") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
