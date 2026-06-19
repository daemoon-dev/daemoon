"use client";

/* Daemoon home — value props + inline sign-in (single page). */
import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function sbClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // If already signed in, jump to /dashboard.
    const sb = sbClient();
    sb.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/dashboard");
    });
  }, [router]);

  async function signInGoogle() {
    setErr("");
    const sb = sbClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
  }

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setErr("");
    const sb = sbClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <h1 className="text-5xl font-bold tracking-tight mb-3 text-center">Daemoon</h1>
        <p className="text-neutral-400 mb-8 text-center">
          AI dev infra gateway. One login. Every infrastructure.
        </p>

        <button
          onClick={signInGoogle}
          className="w-full px-4 py-3 rounded-md bg-white text-neutral-900 font-medium hover:bg-neutral-200 transition mb-3"
        >
          Continue with Google
        </button>

        <div className="text-center text-xs text-neutral-600 my-3">or</div>

        {sent ? (
          <div className="p-4 rounded-md border border-neutral-800 bg-neutral-900 text-sm text-neutral-300">
            Magic link sent to <b>{email}</b>. Check your inbox.
          </div>
        ) : (
          <form onSubmit={signInEmail} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-3 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100 font-medium hover:bg-neutral-800 transition disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a magic link"}
            </button>
          </form>
        )}

        {err && <div className="mt-4 text-sm text-red-400">{err}</div>}

        <p className="mt-10 text-xs text-neutral-600 text-center leading-relaxed">
          Connect Vercel, GitHub, Cloudflare, Supabase once.
          <br />
          Any AI agent then deploys end-to-end — no more pasting tokens.
        </p>
        <p className="mt-4 text-xs text-neutral-700 text-center">
          MCP-native · open core · per-user encrypted vault
        </p>
        <p className="mt-4 text-xs text-neutral-600 text-center">
          <a
            href="https://github.com/daemoon-dev/daemoon"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-300"
          >
            GitHub
          </a>
          {" · "}
          <a
            href="https://github.com/daemoon-dev/daemoon/issues"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-300"
          >
            Feedback
          </a>
        </p>
      </div>
    </main>
  );
}
