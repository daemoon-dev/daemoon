/* Daemoon — OpenAI connector.
 *
 * OpenAI = LLM/embedding/image gen. OAuth 없음 — API key (sk-…) 만.
 *   1) 사용자가 platform.openai.com/api-keys 에서 token 발급
 *   2) Daemoon 가 GET /models 로 유효성 검증
 *   3) vault 저장 후 사용
 *
 * MVP 도구:
 *   1) openai.list_models()
 *   2) openai.chat_completion({ model, messages, max_tokens? })
 */
import type { Connector, ToolContext, ToolDef } from "../types";

const API = "https://api.openai.com/v1";

async function oai<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(new URL(path, API + "/"), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "Daemoon/0.1",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`OpenAI ${init.method ?? "GET"} ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("OpenAI not connected — paste API key.");
  return ctx.token;
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

const listModels: ToolDef<Record<string, never>, { models: string[] }> = {
  name: "openai.list_models",
  description: "내 OpenAI 키로 사용 가능한 model id 목록.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const token = reqTok(ctx);
    const data = await oai<{ data: Array<{ id: string }> }>("models", token);
    return { models: (data.data ?? []).map(m => m.id) };
  },
};

const chatCompletion: ToolDef<
  { model: string; messages: ChatMessage[]; max_tokens?: number },
  { id: string; model: string; content: string | null; finish_reason: string | null; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
> = {
  name: "openai.chat_completion",
  description: "OpenAI Chat Completions API 호출.",
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
            role: { type: "string", enum: ["system", "user", "assistant", "tool"] },
            content: { type: "string" },
          },
          required: ["role", "content"],
          additionalProperties: false,
        },
      },
      max_tokens: { type: "number", minimum: 1 },
    },
    required: ["model", "messages"],
    additionalProperties: false,
  },
  async handler({ model, messages, max_tokens }, ctx) {
    const token = reqTok(ctx);
    const payload: Record<string, unknown> = { model, messages };
    if (max_tokens !== undefined) payload.max_tokens = max_tokens;
    const data = await oai<ChatCompletionResponse>(
      "chat/completions",
      token,
      { method: "POST", body: JSON.stringify(payload) },
    );
    const choice = data.choices?.[0];
    return {
      id: data.id,
      model: data.model,
      content: choice?.message?.content ?? null,
      finish_reason: choice?.finish_reason ?? null,
      usage: data.usage,
    };
  },
};

export const openaiConnector: Connector = {
  id: "openai",
  label: "OpenAI",
  oauthSupported: false,

  async validatePat(pat: string) {
    try {
      const res = await fetch(new URL("models", API + "/"), {
        headers: { Authorization: `Bearer ${pat}`, "User-Agent": "Daemoon/0.1" },
      });
      if (!res.ok) return { ok: false as const, reason: `OpenAI API ${res.status}` };
      const org = res.headers.get("openai-organization");
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return {
        ok: true as const,
        meta: {
          modelCount: json.data?.length ?? 0,
          organization: org ?? null,
        },
      };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },

  tools: [listModels, chatCompletion],
};
