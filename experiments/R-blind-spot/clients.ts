/**
 * experiments/R-blind-spot/clients.ts
 *
 * A family-agnostic chat surface so the panel runner is blind to which model
 * family it is calling. The Anthropic rail reuses the existing experiment
 * client verbatim; the OpenAI rail wraps the SDK behind the same interface.
 *
 * INVARIANT for R: each call is a FRESH context (no shared history), so "3
 * Claude checkers" is genuinely three independent error sources, not one
 * conversation forked three ways. We therefore never thread prior messages.
 */

import OpenAI from "openai";
import { AnthropicClient } from "../polarization-1/orchestrator/anthropic-client";

export interface ChatCall {
  system: string;
  user: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** GPT rail only: force response_format json_object so output is always valid JSON. */
  jsonMode?: boolean;
}

export interface ChatResult {
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ChatClient {
  readonly family: string;
  chat(call: ChatCall): Promise<ChatResult>;
}

/** Claude rail — same-family panel + one cross-family generator option. */
export class ClaudeClient implements ChatClient {
  readonly family = "claude";
  private inner: AnthropicClient;
  constructor(apiKey = process.env.ANTHROPIC_API_KEY ?? "") {
    this.inner = new AnthropicClient(apiKey);
  }
  async chat(call: ChatCall): Promise<ChatResult> {
    const res = await this.inner.chat({
      system: call.system,
      messages: [{ role: "user", content: call.user }],
      model: call.model,
      temperature: call.temperature ?? 0,
      maxTokens: call.maxTokens ?? 1500,
    });
    return { text: res.text, usage: res.usage };
  }
}

/** GPT rail — cross-family panel member + the plausible-error generator. */
export class GptClient implements ChatClient {
  readonly family = "gpt";
  private inner: OpenAI;
  constructor(apiKey = process.env.OPENAI_API_KEY ?? "") {
    if (!apiKey) throw new Error("GptClient: OPENAI_API_KEY is required");
    this.inner = new OpenAI({ apiKey });
  }
  async chat(call: ChatCall): Promise<ChatResult> {
    const res = await this.inner.chat.completions.create({
      model: call.model,
      temperature: call.temperature ?? 0,
      max_tokens: call.maxTokens ?? 1500,
      ...(call.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: call.user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    return {
      text,
      usage: {
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      },
    };
  }
}

/** Default model ids for the pilot. */
export const MODELS = {
  claude: "claude-haiku-4-5-20251001", // matches the production judge model
  gpt: "gpt-4o",
} as const;

export function clientFor(family: "claude" | "gpt"): ChatClient {
  return family === "claude" ? new ClaudeClient() : new GptClient();
}
