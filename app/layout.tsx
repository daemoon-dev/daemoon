import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://daemoon.dev"),
  title: "Daemoon — One login. Every infrastructure.",
  description:
    "AI dev infra gateway. One PAT, any MCP agent: Vercel, GitHub, Cloudflare, Supabase, GCP, Stripe, Resend, OpenAI, Anthropic — unified dev infra gateway.",
  openGraph: {
    title: "Daemoon — One login. Every infrastructure.",
    description:
      "One PAT, any MCP agent: Vercel, GitHub, Cloudflare, Supabase, GCP, Stripe, Resend, OpenAI, Anthropic.",
    url: "https://daemoon.dev",
    siteName: "Daemoon",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daemoon — One login. Every infrastructure.",
    description: "AI dev infra gateway. One PAT for Vercel / GitHub / Cloudflare / Supabase / GCP / Stripe / Resend / OpenAI / Anthropic.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
