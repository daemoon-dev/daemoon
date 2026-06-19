/* Daemoon — Stripe connector.
 *
 * Stripe has *OAuth (Stripe Connect)* but for MVP we only use a PAT (Secret key).
 *   1) User copies sk_test_… / sk_live_… from dashboard.stripe.com/apikeys
 *   2) Daemoon validates via GET /v1/account
 *   3) Stored in vault and used
 *
 * MVP tools:
 *   1) stripe.list_products({ limit? })
 *   2) stripe.list_customers({ limit?, email? })
 *   3) stripe.create_payment_link({ price, quantity? })
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.stripe.com";

async function st<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "Daemoon/1.1 (+https://daemoon.dev)",
      // Pin the API version so contract changes don't silently break us.
      "Stripe-Version": "2024-12-18.acacia",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Stripe ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("Stripe not connected — paste Secret key.");
  return ctx.token;
}

interface StripeListResponse<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  url: string;
}

interface StripeProduct {
  id: string;
  name: string;
  active: boolean;
  description: string | null;
}

interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
}

interface StripePaymentLink {
  id: string;
  url: string;
  active: boolean;
}

const listProducts: ToolDef<
  { limit?: number },
  { products: Array<{ id: string; name: string; active: boolean; description: string | null }>; has_more: boolean }
> = {
  name: "stripe.list_products",
  description: "List Stripe products.",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", minimum: 1, maximum: 100, default: 10 } },
    additionalProperties: false,
  },
  async handler({ limit = 10 }, ctx) {
    const token = reqTok(ctx);
    const data = await st<StripeListResponse<StripeProduct>>(
      `/v1/products?limit=${limit}`,
      token,
    );
    return {
      products: data.data.map(p => ({ id: p.id, name: p.name, active: p.active, description: p.description })),
      has_more: data.has_more,
    };
  },
};

const listCustomers: ToolDef<
  { limit?: number; email?: string },
  { customers: Array<{ id: string; email: string | null; name: string | null; created: number }>; has_more: boolean }
> = {
  name: "stripe.list_customers",
  description: "List Stripe customers. Filter by email if provided.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      email: { type: "string" },
    },
    additionalProperties: false,
  },
  async handler({ limit = 10, email }, ctx) {
    const token = reqTok(ctx);
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (email) qs.set("email", email);
    const data = await st<StripeListResponse<StripeCustomer>>(
      `/v1/customers?${qs.toString()}`,
      token,
    );
    return {
      customers: data.data.map(c => ({ id: c.id, email: c.email, name: c.name, created: c.created })),
      has_more: data.has_more,
    };
  },
};

const createPaymentLink: ToolDef<
  { price: string; quantity?: number },
  { id: string; url: string; active: boolean }
> = {
  name: "stripe.create_payment_link",
  description: "Create a Payment Link for the given price.",
  inputSchema: {
    type: "object",
    properties: {
      price: { type: "string", minLength: 1 },
      quantity: { type: "number", minimum: 1, default: 1 },
    },
    required: ["price"],
    additionalProperties: false,
  },
  async handler({ price, quantity = 1 }, ctx) {
    const token = reqTok(ctx);
    const body = new URLSearchParams();
    body.set("line_items[0][price]", price);
    body.set("line_items[0][quantity]", String(quantity));
    const data = await st<StripePaymentLink>(
      "/v1/payment_links",
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    return { id: data.id, url: data.url, active: data.active };
  },
};

export const stripeConnector: Connector = {
  id: "stripe",
  label: "Stripe",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("/v1/account", API), {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemoon/0.1" },
      });
      if (!res.ok) return { ok: false as const, reason: `Stripe API ${res.status}` };
      const acct = (await res.json()) as { id: string; email?: string | null; business_profile?: { name?: string | null } | null };
      return {
        ok: true as const,
        meta: {
          accountId: acct.id,
          email: acct.email ?? null,
          businessName: acct.business_profile?.name ?? null,
        },
      };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [listProducts, listCustomers, createPaymentLink],
};
