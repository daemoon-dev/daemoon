"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  label: string;
  isConnected: boolean;
  useOauth: boolean;
}

export function ConnectionRow({ id, label, isConnected, useOauth }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!confirm(`Disconnect ${label}? The stored token will be deleted.`)) return;
    setBusy(true);
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-md border border-neutral-800 bg-neutral-900">
      <div>
        <div className="text-lg font-medium">{label}</div>
        <div className="text-sm text-neutral-500">
          {useOauth ? "1-click sign in" : "API token (paste once)"}
        </div>
      </div>
      {isConnected ? (
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 text-sm">✓ Connected</span>
          <button
            onClick={disconnect}
            disabled={busy}
            className="text-xs text-neutral-500 hover:text-red-400 disabled:opacity-50"
          >
            {busy ? "…" : "Disconnect"}
          </button>
        </div>
      ) : useOauth ? (
        <a
          href={`/api/oauth/${id}/start`}
          className="px-4 py-2 rounded-md bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200"
        >
          Connect
        </a>
      ) : (
        <a
          href={`/connect/${id}`}
          className="px-4 py-2 rounded-md bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-200"
        >
          Connect
        </a>
      )}
    </div>
  );
}
