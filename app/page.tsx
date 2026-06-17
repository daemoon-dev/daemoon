/* Daemun home — 로그인 안내 + 가치 한 줄. */
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-8">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-3">Daemun</h1>
        <p className="text-neutral-400 mb-8 text-lg">
          AI dev infra gateway. One login. Every infrastructure.
        </p>
        <p className="text-neutral-500 mb-10 leading-relaxed">
          Connect Vercel, GitHub, Cloudflare, Supabase once.
          Then any AI coding agent (Claude Code, Cursor) can deploy
          your apps end-to-end — no more pasting tokens.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 rounded-md bg-white text-neutral-900 font-medium hover:bg-neutral-200 transition"
        >
          Sign in with Google
        </Link>
        <p className="mt-12 text-xs text-neutral-600">
          MCP-native · open core · per-user encrypted vault
        </p>
      </div>
    </main>
  );
}
