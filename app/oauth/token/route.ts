/* OAuth 2.0 Token endpoint — authorization_code grant with PKCE.
 *
 * Exchanges a one-time code for the bound PAT and returns it as access_token.
 * The PAT is then sent by the client as `Authorization: Bearer dmn_...` to /api/mcp.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServiceClient } from "@/lib/supabase/service";

async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
  if (ct.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  return {};
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseBody(req);
    if (body.grant_type !== "authorization_code") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    }
    const { code, redirect_uri, code_verifier, client_id } = body;
    if (!code || !redirect_uri) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const sb = getServiceClient();
    const { data: row, error } = await sb
      .from("daemoon_oauth_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error || !row) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }
    if (row.exchanged) {
      return NextResponse.json({ error: "invalid_grant", error_description: "code already used" }, { status: 400 });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "invalid_grant", error_description: "code expired" }, { status: 400 });
    }
    if (row.redirect_uri !== redirect_uri) {
      return NextResponse.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, { status: 400 });
    }
    if (client_id && row.client_id && client_id !== row.client_id) {
      return NextResponse.json({ error: "invalid_grant", error_description: "client_id mismatch" }, { status: 400 });
    }

    // Verify PKCE if a challenge was provided.
    if (row.code_challenge) {
      if (!code_verifier) {
        return NextResponse.json({ error: "invalid_grant", error_description: "code_verifier required" }, { status: 400 });
      }
      const method = (row.code_challenge_method ?? "plain").toLowerCase();
      const verified =
        method === "s256"
          ? createHash("sha256").update(code_verifier).digest("base64url") === row.code_challenge
          : code_verifier === row.code_challenge;
      if (!verified) {
        return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400 });
      }
    }

    // Burn the code, return the PAT as access_token.
    await sb
      .from("daemoon_oauth_codes")
      .update({ exchanged: true, pat_raw: "" })
      .eq("code", code);

    return NextResponse.json(
      {
        access_token: row.pat_raw,
        token_type: "Bearer",
        expires_in: 31536000,
        scope: "mcp",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "server_error", error_description: msg }, { status: 500 });
  }
}
