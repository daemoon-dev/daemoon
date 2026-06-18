"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountHeader({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/signout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-800">
      <div>
        <div className="text-xl font-bold">Daemoon</div>
        <div className="text-xs text-neutral-500">{email}</div>
      </div>
      <button
        onClick={signOut}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
