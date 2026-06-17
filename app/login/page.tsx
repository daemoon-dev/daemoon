"use client";

/* Daemun login — Google OAuth + email magic link.
 *
 * Email 은 *fallback* — Google OAuth 가 막혀있어도 들어올 수 있게.
 */
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

function sbClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInGoogle() {
    setErr("");
    const sb = sbClient();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
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
      <div className="max-w-sm w-full">
        <h1 className="text-3xl font-bold mb-2">Sign in</h1>
        <p className="text-neutral-400 mb-8">Connect once, ship forever.</p>

        <button
          onClick={signInGoogle}
          className="w-full px-4 py-3 rounded-md bg-white text-neutral-900 font-medium hover:bg-neutral-200 transition mb-4"
        >
          Continue with Google
        </button>

        <div className="text-center text-xs text-neutral-600 my-4">or</div>

        {sent ? (
          <div className="p-4 rounded-md border border-neutral-800 bg-neutral-900 text-sm text-neutral-300">
            We sent a magic link to <b>{email}</b>. Open your email and click the link to sign in.
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

        <a href="/" className="block mt-8 text-center text-xs text-neutral-600 hover:text-neutral-400">
          ← back
        </a>
      </div>
    </main>
  );
}
