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
    "Open-source MCP gateway. One bearer token gives Claude Code, Cursor, Cline, Continue, Zed, and any MCP-aware agent unified, encrypted access to Vercel, GitHub, Cloudflare, Supabase, GCP, Stripe, Resend, OpenAI, and Anthropic.",
  keywords: [
    "MCP",
    "Model Context Protocol",
    "MCP server",
    "MCP gateway",
    "Claude Code",
    "Cursor",
    "AI coding agent",
    "Vercel",
    "GitHub",
    "Cloudflare",
    "Supabase",
    "Google Cloud",
    "Stripe",
    "Resend",
    "OpenAI",
    "Anthropic",
  ],
  alternates: {
    types: {
      "application/json": [
        { url: "/.well-known/mcp.json", title: "Daemoon MCP server card" },
      ],
    },
  },
  other: {
    "mcp:endpoint": "https://daemoon.dev/api/mcp",
    "mcp:server-card": "https://daemoon.dev/.well-known/mcp.json",
    "mcp:transport": "http",
    "mcp:protocol-version": "2025-06-18",
  },
  openGraph: {
    title: "Daemoon — One login. Every infrastructure.",
    description:
      "Open-source MCP gateway. One bearer token for Vercel, GitHub, Cloudflare, Supabase, GCP, Stripe, Resend, OpenAI, Anthropic — usable from Claude Code, Cursor, Cline, Continue, Zed.",
    url: "https://daemoon.dev",
    siteName: "Daemoon",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daemoon — One login. Every infrastructure.",
    description: "Open-source MCP gateway. One PAT for 9 providers, usable from any MCP-aware AI coding agent.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Daemoon",
  "description":
    "Open-source MCP gateway. One bearer token gives Claude Code, Cursor, Cline, Continue, Zed and any MCP-aware AI coding agent unified, encrypted access to Vercel, GitHub, Cloudflare, Supabase, GCP, Stripe, Resend, OpenAI, and Anthropic.",
  "url": "https://daemoon.dev",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "softwareVersion": "1.3.0",
  "license": "https://opensource.org/licenses/MIT",
  "codeRepository": "https://github.com/daemoon-dev/daemoon",
  "potentialAction": {
    "@type": "ConsumeAction",
    "target": "https://daemoon.dev/api/mcp",
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
