/* Daemoon — Stripe connector.
 *
 * Stripe 는 *OAuth (Stripe Connect)* 가 따로 있지만 MVP 에서는 PAT (Secret key) 만 사용.
 *   1) 사용자가 dashboard.stripe.com/apikeys 에서 sk_test_… / sk_live_… 복사
 *   2) Daemoon 가 GET /v1/account 로 유효성 검증
 *   3) vault 저장 후 사용
 *
 * MVP 도구:
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
      "User-Agent": "Daemoon/0.1",
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
  description: "Stripe products 목록.",
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
  description: "Stripe customers 목록. email 로 필터 가능.",
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
  description: "지정 price 로 Payment Link 생성.",
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
