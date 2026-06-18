/* Daemoon — Anthropic connector.
 *
 * Anthropic = Claude API. OAuth 없음 — API key (sk-ant-…) 만.
 *   - 인증 헤더는 *Bearer 아닌* `x-api-key`.
 *   - 모든 요청에 `anthropic-version: 2023-06-01` 필수.
 *   1) 사용자가 console.anthropic.com/settings/keys 에서 token 발급
 *   2) Daemoon 가 POST /messages 에 1-token ping 으로 검증
 *   3) vault 저장 후 사용
 *
 * MVP 도구:
 *   1) anthropic.create_message({ model, messages, max_tokens? })
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

async function an<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API + "/"), {
    ...init,
    headers: {
      "x-api-key": token,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
      "User-Agent": "Daemoon/0.1",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Anthropic ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("Anthropic not connected — paste API key.");
  return ctx.token;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicMessageResponse {
  id: string;
  model: string;
  role: "assistant";
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
  usage?: { input_tokens: number; output_tokens: number };
}

const createMessage: ToolDef<
  { model: string; messages: AnthropicMessage[]; max_tokens?: number },
  { id: string; model: string; text: string; stop_reason: string | null; usage?: { input_tokens: number; output_tokens: number } }
> = {
  name: "anthropic.create_message",
  description: "Anthropic Messages API 호출 (Claude).",
  inputSchema: {
    type: "object",
    properties: {
      model: { type: "string", minLength: 1 },
      messages: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string" },
          },
          required: ["role", "content"],
          additionalProperties: false,
        },
      },
      max_tokens: { type: "number", minimum: 1, default: 1024 },
    },
    required: ["model", "messages"],
    additionalProperties: false,
  },
  async handler({ model, messages, max_tokens = 1024 }, ctx) {
    const token = reqTok(ctx);
    const payload = { model, messages, max_tokens };
    const data = await an<AnthropicMessageResponse>(
      "messages",
      token,
      { method: "POST", body: JSON.stringify(payload) },
    );
    const text = (data.content ?? [])
      .filter(b => b.type === "text" && typeof b.text === "string")
      .map(b => b.text as string)
      .join("");
    return {
      id: data.id,
      model: data.model,
      text,
      stop_reason: data.stop_reason,
      usage: data.usage,
    };
  },
};

export const anthropicConnector: Connector = {
  id: "anthropic",
  label: "Anthropic",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("messages", API + "/"), {
        method: "POST",
        headers: {
          "x-api-key": pat,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
          "User-Agent": "Daemoon/0.1",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (!res.ok) return { ok: false as const, reason: `Anthropic API ${res.status}` };
      const json = (await res.json()) as { model?: string };
      return { ok: true as const, meta: { pingModel: json.model ?? null } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [createMessage],
};
