/* OAuth 2.0 Dynamic Client Registration (RFC 7591).
 * Smithery (and other MCP proxies) POST here to register a redirect URI. */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const redirectUris = (body?.redirect_uris ?? []) as string[];
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
    }
    const clientName = (body?.client_name as string | undefined)?.slice(0, 100) ?? null;
    const reqGrantTypes = Array.isArray(body?.grant_types) ? body.grant_types : ["authorization_code"];
    const reqResponseTypes = Array.isArray(body?.response_types) ? body.response_types : ["code"];
    const reqAppType = typeof body?.application_type === "string" ? body.application_type : "web";
    const reqScope = typeof body?.scope === "string" ? body.scope : "mcp";
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("daemoon_oauth_clients")
      .insert({ redirect_uris: redirectUris, client_name: clientName })
      .select("client_id")
      .single();
    if (error || !data) throw error || new Error("client insert failed");
    return NextResponse.json(
      {
        client_id: data.client_id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: redirectUris,
        grant_types: reqGrantTypes,
        response_types: reqResponseTypes,
        application_type: reqAppType,
        token_endpoint_auth_method: "none",
        scope: reqScope,
        client_name: clientName,
      },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
