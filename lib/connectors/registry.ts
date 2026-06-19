/* Daemoon connector registry — single source for provider id → Connector mapping.
 *
 * To add a provider, import and register it here; MCP, OAuth, and UI pick it up automatically.
 */
import type { Connector } from "./types";
import { vercelConnector } from "./vercel";
import { githubConnector } from "./github";
import { cloudflareConnector } from "./cloudflare";
import { supabaseConnector } from "./supabase";
import { gcpConnector } from "./gcp";
import { stripeConnector } from "./stripe";
import { resendConnector } from "./resend";
import { openaiConnector } from "./openai";
import { anthropicConnector } from "./anthropic";

export const CONNECTORS: Record<string, Connector> = {
  [vercelConnector.id]: vercelConnector,
  [githubConnector.id]: githubConnector,
  [cloudflareConnector.id]: cloudflareConnector,
  [supabaseConnector.id]: supabaseConnector,
  [gcpConnector.id]: gcpConnector,
  [stripeConnector.id]: stripeConnector,
  [resendConnector.id]: resendConnector,
  [openaiConnector.id]: openaiConnector,
  [anthropicConnector.id]: anthropicConnector,
};

export function getConnector(id: string): Connector {
  const c = CONNECTORS[id];
  if (!c) throw new Error(`Unknown connector: ${id}`);
  return c;
}

export function listConnectors(): Connector[] {
  return Object.values(CONNECTORS);
}
