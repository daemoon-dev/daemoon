/* Daemun connector registry — provider id → Connector 매핑 단일 source.
 *
 * 새 provider 추가 시 여기에 import + 등록만 하면 MCP/OAuth/UI 모두 자동 반영.
 */
import type { Connector } from "./types";
import { vercelConnector } from "./vercel";
import { githubConnector } from "./github";
import { cloudflareConnector } from "./cloudflare";
import { supabaseConnector } from "./supabase";

export const CONNECTORS: Record<string, Connector> = {
  [vercelConnector.id]: vercelConnector,
  [githubConnector.id]: githubConnector,
  [cloudflareConnector.id]: cloudflareConnector,
  [supabaseConnector.id]: supabaseConnector,
};

export function getConnector(id: string): Connector {
  const c = CONNECTORS[id];
  if (!c) throw new Error(`Unknown connector: ${id}`);
  return c;
}

export function listConnectors(): Connector[] {
  return Object.values(CONNECTORS);
}
