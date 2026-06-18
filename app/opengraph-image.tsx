/* Daemoon OG image — auto-served for / and child routes. */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Daemoon — AI dev infra gateway";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #18181b 100%)",
          color: "#fafafa",
          padding: "60px 80px",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -3, marginBottom: 20 }}>
          Daemoon
        </div>
        <div style={{ fontSize: 38, color: "#a3a3a3", marginBottom: 60, textAlign: "center" }}>
          One login. Every infrastructure.
        </div>
        <div style={{
          display: "flex",
          gap: 20,
          fontSize: 28,
          color: "#737373",
          marginBottom: 50,
        }}>
          <span>Vercel</span>
          <span>·</span>
          <span>GitHub</span>
          <span>·</span>
          <span>Cloudflare</span>
          <span>·</span>
          <span>Supabase</span>
          <span>·</span>
          <span>GCP</span>
        </div>
        <div style={{ fontSize: 22, color: "#525252" }}>
          MCP-native · open core · per-user encrypted vault
        </div>
        <div style={{ position: "absolute", bottom: 40, right: 60, fontSize: 20, color: "#404040" }}>
          daemoon.dev
        </div>
      </div>
    ),
    { ...size },
  );
}
