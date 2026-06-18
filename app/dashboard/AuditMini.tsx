"use client";

/* Audit mini-view — last 5 tool calls. Shows transparency. */
import { useEffect, useState } from "react";

interface AuditRow {
  id: string;
  provider: string;
  tool: string;
  ok: boolean;
  created_at: string;
}

export function AuditMini() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    fetch("/api/audit").then(r => r.json()).then(d => setRows(d.rows ?? []));
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-2">Recent agent activity</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Every tool call is logged. Tokens are never exposed; only the response goes back to the agent.
      </p>
      <ul className="divide-y divide-neutral-800 rounded-md border border-neutral-800 bg-neutral-900">
        {rows.map(r => (
          <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="flex items-center gap-3">
              <span className={r.ok ? "text-emerald-400" : "text-red-400"}>{r.ok ? "✓" : "✗"}</span>
              <code className="text-neutral-200">{r.tool}</code>
            </span>
            <span className="text-xs text-neutral-500">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
