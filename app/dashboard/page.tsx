/* Daemoon dashboard — account header + MCP install + provider connections.
 *
 * Server component — enforces login and fetches connection state from DB.
 */
import { redirect } from "next/navigation";
import { listConnectors } from "@/lib/connectors/registry";
import { getServerSupabase } from "@/lib/auth";
import { InstallMcp } from "./InstallMcp";
import { AccountHeader } from "./AccountHeader";
import { ConnectionRow } from "./ConnectionRow";
import { TryItPanel } from "./TryItPanel";
import { AuditMini } from "./AuditMini";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const sb = await getServerSupabase();
  const { data: userRes } = await sb.auth.getUser();
  if (!userRes.user) redirect("/");

  const { data: connRows } = await sb.from("daemoon_my_connections").select("*");
  const connected = new Set((connRows ?? []).map(r => r.provider as string));

  const connectors = listConnectors();

  function oauthReady(providerId: string): boolean {
    if (providerId === "vercel") return !!(process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET);
    if (providerId === "github") return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    if (providerId === "supabase") return !!(process.env.SUPABASE_CLIENT_ID && process.env.SUPABASE_CLIENT_SECRET);
    return false;
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-3xl mx-auto">
        <AccountHeader email={userRes.user.email ?? ""} />

        <InstallMcp />

        <TryItPanel connectedProviders={Array.from(connected)} />

        <AuditMini />

        <h2 className="text-xl font-semibold mb-2">Connections</h2>
        <p className="text-neutral-400 text-sm mb-4">
          Connect each provider once. The agent uses these via the MCP token above.
        </p>
        <div className="grid gap-3">
          {connectors.map(c => (
            <ConnectionRow
              key={c.id}
              id={c.id}
              label={c.label}
              isConnected={connected.has(c.id)}
              useOauth={!!c.oauthSupported && oauthReady(c.id)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
