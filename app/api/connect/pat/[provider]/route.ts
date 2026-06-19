/* For connectors that take a PAT directly — Cloudflare / Supabase / etc.
 *
 *   POST /api/connect/pat/cloudflare
 *   body: { token: "abc..." }
 *
 *   → connector.validatePat() → on success, store in vault.
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
    // v0.4 — also allow PAT input on OAuth-supported connectors (Vercel/GitHub accept PATs too).
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
