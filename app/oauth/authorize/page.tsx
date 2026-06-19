/* OAuth 2.0 Authorization endpoint (PKCE code flow).
 *
 * Flow: client (Smithery) → /oauth/authorize?client_id=…&redirect_uri=…&code_challenge=… &state=…
 *   1) Verify the user is signed in (Supabase session). If not, send to / for sign-in then come back.
 *   2) On confirm, mint a one-time PAT, store the code → PAT mapping, redirect back with ?code=… &state=…
 */
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { getServerSupabase } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { createPat } from "@/lib/pat";

export const dynamic = "force-dynamic";

interface SearchParams {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  response_type?: string;
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  if ((sp.response_type ?? "code") !== "code") {
    return (
      <ErrorPanel
        title="Unsupported response_type"
        detail="Only 'code' is supported."
      />
    );
  }
  if (!sp.client_id || !sp.redirect_uri) {
    return (
      <ErrorPanel
        title="Missing parameters"
        detail="client_id and redirect_uri are required."
      />
    );
  }

  // Validate the client + that the redirect_uri matches a registered URI.
  const svc = getServiceClient();
  const { data: client } = await svc
    .from("daemoon_oauth_clients")
    .select("client_id, redirect_uris")
    .eq("client_id", sp.client_id)
    .maybeSingle();
  if (!client) {
    return <ErrorPanel title="Unknown client_id" detail="Register first via /oauth/register." />;
  }
  if (!client.redirect_uris.includes(sp.redirect_uri)) {
    return <ErrorPanel title="redirect_uri not registered" detail={sp.redirect_uri} />;
  }

  // Require an authenticated session. If not signed in, bounce to the login page
  // and come back here after.
  const sb = await getServerSupabase();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes.user) {
    const url = new URL("https://daemoon.dev");
    url.pathname = "/";
    const back = new URL("https://daemoon.dev/oauth/authorize");
    Object.entries(sp).forEach(([k, v]) => v && back.searchParams.set(k, v));
    url.searchParams.set("next", "/oauth/authorize?" + back.searchParams.toString());
    redirect(url.toString());
  }

  // Mint a PAT and bind it to a one-time authorization code.
  const userId = userRes.user!.id;
  const { raw, prefix } = await createPat(userId, `OAuth: ${sp.client_id.slice(0, 8)}`);
  const code = randomBytes(24).toString("base64url");
  const { error: codeErr } = await svc.from("daemoon_oauth_codes").insert({
    code,
    user_id: userId,
    pat_id: prefix,
    pat_raw: raw,
    redirect_uri: sp.redirect_uri,
    code_challenge: sp.code_challenge ?? null,
    code_challenge_method: sp.code_challenge_method ?? null,
    client_id: sp.client_id,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (codeErr) {
    return <ErrorPanel title="Authorization failed" detail={codeErr.message} />;
  }

  const back = new URL(sp.redirect_uri);
  back.searchParams.set("code", code);
  if (sp.state) back.searchParams.set("state", sp.state);
  redirect(back.toString());
}

function ErrorPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold mb-3">{title}</h1>
        <p className="text-sm text-neutral-400">{detail}</p>
      </div>
    </main>
  );
}
