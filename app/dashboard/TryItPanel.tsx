"use client";

/* Try It Now — runs a real MCP tools/call inline using the session cookie.
 * No PAT needed. Lets users see Daemoon work before they install.
 */
import { useState, useEffect } from "react";

interface ToolInfo {
  name: string;
  description: string;
  provider: string;
}

export function TryItPanel({ connectedProviders }: { connectedProviders: string[] }) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "tools/list" }),
    })
      .then(r => r.json())
      .then(d => {
        const list = (d?.result?.tools ?? []).map((t: { name: string; description: string }) => {
          const provider = t.name.split(".")[0];
          return { name: t.name, description: t.description, provider };
        });
        // only show tools from connected providers + zero-arg ones (safe to demo)
        const connected = new Set(connectedProviders);
        const safe = list.filter((t: ToolInfo) => connected.has(t.provider) && t.name.endsWith("_projects"));
        setTools(safe.length ? safe : list.filter((t: ToolInfo) => connected.has(t.provider)).slice(0, 3));
        if (safe[0]) setSelected(safe[0].name);
      })
      .catch(() => {});
  }, [connectedProviders]);

  async function run() {
    if (!selected) return;
    setBusy(true);
    setErr("");
    setOutput("");
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "tools/call",
          params: { name: selected, arguments: {} },
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || `HTTP ${res.status}`);
      setOutput(JSON.stringify(data.result, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  if (connectedProviders.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-2">Try it now</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Run any tool live in the browser. No install required — proof the agent will get the same result.
      </p>

      <div className="flex gap-2 mb-3">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-100 focus:outline-none focus:border-neutral-600"
        >
          <option value="">— pick a tool —</option>
          {tools.map(t => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={busy || !selected}
          className="px-4 py-2 rounded-md bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run"}
        </button>
      </div>

      {(output || err) && (
        <pre className="p-3 rounded-md bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 overflow-x-auto max-h-72 whitespace-pre-wrap">
          {err ? <span className="text-red-400">{err}</span> : output}
        </pre>
      )}
    </section>
  );
}
