"use client";

/* Install MCP — client-side widget to create a PAT and show Claude Code config.
 *
 * Flow:
 *   1) User clicks "Generate token" → POST /api/pat → raw shown ONCE
 *   2) Config snippet auto-populated with that token
 *   3) "Copy" button
 *   4) Existing PATs listed (prefix only)
 */
import { useEffect, useState } from "react";

interface PatRow {
  id: string;
  label: string | null;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export function InstallMcp() {
  const [pats, setPats] = useState<PatRow[]>([]);
  const [rawToken, setRawToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/pat").then(r => r.json()).then(d => setPats(d.pats ?? []));
  }, []);

  async function generate() {
    setBusy(true);
    setErr("");
    setCopied(false);
    try {
      const res = await fetch("/api/pat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Claude Code" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRawToken(data.raw);
      // refresh list
      const list = await fetch("/api/pat").then(r => r.json());
      setPats(list.pats ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const chatMsg = `Install the Daemoon MCP server for me by running:\nclaude mcp add --transport http daemoon https://daemoon.dev/api/mcp --header "Authorization: Bearer ${rawToken || "dmn_YOUR_TOKEN"}"`;

  async function copyCli() {
    await navigator.clipboard.writeText(cliCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-2">Install in Claude Code</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Generate a token. Copy the snippet. Paste it into Claude Code.
        Done — the agent gets every connected provider above.
      </p>

      {!rawToken ? (
        <button
          onClick={generate}
          disabled={busy}
          className="px-4 py-2 rounded-md bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
        >
          {busy ? "Generating…" : pats.length > 0 ? "Generate new token" : "Generate token"}
        </button>
      ) : (
        <>
          <div className="mb-2 text-sm text-neutral-300">
            Paste this into your Claude Code chat:
          </div>
          <div className="relative">
            <pre className="p-4 pr-32 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 overflow-x-auto whitespace-pre-wrap break-all">
{chatMsg}
            </pre>
            <button
              onClick={copyCli}
              className="absolute top-2 right-2 px-4 py-2 rounded-md bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200"
            >
              {copied ? "✓ copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Claude will run the install for you — no terminal needed.
          </p>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-neutral-600 hover:text-neutral-400">
              Show raw token
            </summary>
            <code className="block mt-2 p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-300 break-all">
              {rawToken}
            </code>
          </details>
        </>
      )}

      {err && <div className="mt-3 text-sm text-red-400">{err}</div>}

      {pats.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-neutral-500 hover:text-neutral-300">
            Existing tokens ({pats.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {pats.map(p => (
              <li key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  <code className="text-neutral-300">{p.prefix}…</code>
                  {p.label && <span className="ml-2">— {p.label}</span>}
                  <span className="ml-2 text-neutral-600">
                    · created {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </span>
                <button
                  onClick={async () => {
                    if (!confirm(`Revoke this token? It will stop working in Claude Code immediately.`)) return;
                    await fetch(`/api/pat/${p.id}`, { method: "DELETE" });
                    const list = await fetch("/api/pat").then(r => r.json());
                    setPats(list.pats ?? []);
                  }}
                  className="text-neutral-500 hover:text-red-400 ml-3"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
