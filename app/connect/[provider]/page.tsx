/* PAT input page — shared by Cloudflare / Supabase / Vercel / GitHub. */
"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface ProviderUiInfo {
  id: string;
  label: string;
  instruction: React.ReactNode;
  helpUrl: string;
}

const INFO: Record<string, ProviderUiInfo> = {
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare",
    instruction: (
      <>
        Cloudflare dashboard → My Profile → API Tokens → <b>Create Token</b> → use the
        &quot;Edit zone DNS&quot; template or a Custom token (Zone:Read + DNS:Edit). Paste the token below.
      </>
    ),
    helpUrl: "https://dash.cloudflare.com/profile/api-tokens",
  },
  supabase: {
    id: "supabase",
    label: "Supabase",
    instruction: (
      <>
        Supabase dashboard → Account → Access Tokens → <b>Generate new token</b>. Paste the PAT below.
      </>
    ),
    helpUrl: "https://supabase.com/dashboard/account/tokens",
  },
  vercel: {
    id: "vercel",
    label: "Vercel",
    instruction: (
      <>
        Vercel → Settings → Tokens → <b>Create</b>. Scope: &quot;Full Account&quot; or the team you want to use. Paste the token below.
      </>
    ),
    helpUrl: "https://vercel.com/account/tokens",
  },
  github: {
    id: "github",
    label: "GitHub",
    instruction: (
      <>
        GitHub → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.
        Repository access: All / scopes: Contents (R/W) + Workflows (R/W) + Metadata (R).
      </>
    ),
    helpUrl: "https://github.com/settings/personal-access-tokens/new",
  },
  gcp: {
    id: "gcp",
    label: "Google Cloud",
    instruction: (
      <>
        GCP Console → IAM & Admin → Service Accounts → <b>Create</b> (or pick existing) → Keys tab → <b>Add Key › Create new key › JSON</b> → download the JSON file → paste the full contents below.
      </>
    ),
    helpUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
  },
  stripe: {
    id: "stripe",
    label: "Stripe",
    instruction: (
      <>
        Stripe Dashboard → Developers → API keys → reveal/copy your <b>Secret key</b> (<code>sk_test_…</code> for test mode, <code>sk_live_…</code> for live). Paste below.
      </>
    ),
    helpUrl: "https://dashboard.stripe.com/apikeys",
  },
  resend: {
    id: "resend",
    label: "Resend",
    instruction: (
      <>
        Resend → API Keys → <b>Create API Key</b> → copy the <code>re_…</code> token.
      </>
    ),
    helpUrl: "https://resend.com/api-keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    instruction: (
      <>
        OpenAI Platform → API Keys → <b>Create new secret key</b> → copy <code>sk-…</code>.
      </>
    ),
    helpUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    instruction: (
      <>
        Anthropic Console → API Keys → <b>Create Key</b> → copy <code>sk-ant-…</code>.
      </>
    ),
    helpUrl: "https://console.anthropic.com/settings/keys",
  },
  npm: {
    id: "npm",
    label: "npm",
    instruction: (
      <>
        npmjs.com → avatar → <b>Access Tokens</b> → <b>Generate New Token</b> →
        Classic Token → type <b>Automation</b> (or Granular with read scope). Paste below.
      </>
    ),
    helpUrl: "https://www.npmjs.com/settings/~/tokens",
  },
};

export default function ConnectPatPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = use(params);
  const info = INFO[provider];
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!info) setErr(`Unknown provider: ${provider}`);
  }, [info, provider]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/connect/pat/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      router.push(`/dashboard?connected=${provider}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  if (!info) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
        <p className="text-red-400">{err}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-lg mx-auto">
        <a href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-300">← Dashboard</a>
        <h1 className="text-3xl font-bold mt-4 mb-2">Connect {info.label}</h1>
        <p className="text-neutral-400 mb-6">{info.instruction}</p>
        <a
          href={info.helpUrl}
          target="_blank"
          rel="noreferrer"
          className="block mb-6 text-sm text-blue-400 hover:underline"
        >
          Open {info.label} token page →
        </a>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="paste token here"
            required
            type="password"
            className="w-full px-4 py-3 rounded-md border border-neutral-800 bg-neutral-900 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 font-mono"
          />
          <button
            type="submit"
            disabled={busy || !token}
            className="w-full px-4 py-3 rounded-md bg-white text-neutral-900 font-medium hover:bg-neutral-200 transition disabled:opacity-50"
          >
            {busy ? "Validating…" : "Connect"}
          </button>
        </form>
        {err && <div className="mt-4 text-sm text-red-400">{err}</div>}
        <p className="mt-8 text-xs text-neutral-600 leading-relaxed">
          Your token is encrypted with AES-256-GCM (envelope encryption) before storage.
          It is never logged. You can disconnect any time.
        </p>
      </div>
    </main>
  );
}
