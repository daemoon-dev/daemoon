/* Daemun dashboard — provider 연결 상태 + connect/disconnect.
 *
 * Server component — 로그인 강제 + DB 에서 연결 상태 fetch.
 */
import { redirect } from "next/navigation";
import { listConnectors } from "@/lib/connectors/registry";
import { getServerSupabase } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const sb = await getServerSupabase();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes.user) redirect("/");

  const { data: connRows } = await sb.from("daemun_my_connections").select("*");
  const connected = new Set((connRows ?? []).map(r => r.provider as string));

  const connectors = listConnectors();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Connections</h1>
        <p className="text-neutral-400 mb-8">
          Connect each provider once. AI agents will use these for you.
        </p>
        <div className="grid gap-3">
          {connectors.map(c => {
            const isConn = connected.has(c.id);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-md border border-neutral-800 bg-neutral-900"
              >
                <div>
                  <div className="text-lg font-medium">{c.label}</div>
                  <div className="text-sm text-neutral-500">
                    {c.oauthSupported ? "OAuth · click to authorize" : "API token · paste once"}
                  </div>
                </div>
                {isConn ? (
                  <span className="text-emerald-400 text-sm">✓ Connected</span>
                ) : (
                  // v0.4 — 모든 connector 가 PAT 도 지원. UX 단순화 위해 PAT 페이지 우선.
                  // OAuth 가 셋업되면 그때 OAuth 버튼 추가.
                  <a
                    href={`/connect/${c.id}`}
                    className="px-4 py-2 rounded-md bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200"
                  >
                    Connect
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
