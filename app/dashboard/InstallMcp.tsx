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

  const config = JSON.stringify(
    {
      mcpServers: {
        daemoon: {
          url: "https://daemoon.dev/api/mcp",
          headers: {
            Authorization: `Bearer ${rawToken || "dmn_YOUR_TOKEN_HERE"}`,
          },
        },
      },
    },
    null,
    2,
  );

  async function copyConfig() {
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-2">Install in Claude Code</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Generate a token, paste the snippet into Claude Code, and the agent
        gets every connected provider above.
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
        <div className="mb-3 p-3 rounded-md border border-amber-700 bg-amber-950/40 text-sm">
          <div className="text-amber-300 mb-1 font-medium">
            New token (shown once — copy it now):
          </div>
          <code className="break-all text-amber-100">{rawToken}</code>
        </div>
      )}

      {err && <div className="mt-3 text-sm text-red-400">{err}</div>}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-neutral-400">
            Add this to <code className="text-neutral-300">~/.claude.json</code> →{" "}
            <code className="text-neutral-300">mcpServers</code>:
          </span>
          <button
            onClick={copyConfig}
            className="text-xs text-neutral-400 hover:text-neutral-100"
          >
            {copied ? "✓ copied" : "Copy"}
          </button>
        </div>
        <pre className="p-3 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 overflow-x-auto whitespace-pre">
{config}
        </pre>
      </div>

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
