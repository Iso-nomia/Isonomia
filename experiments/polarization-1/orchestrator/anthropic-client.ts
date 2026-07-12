/**
 * orchestrator/anthropic-client.ts
 *
 * Thin wrapper over Anthropic Messages API. No tool-use — agents return
 * structured JSON in their text response and we parse it.
 *
 * Token bookkeeping is logged via the supplied `RoundLogger` (when present)
 * so a `jq '.kind=="agent_input"'` over a phase's logs can roll up
 * input/output tokens per role.
 *
 * Retries: 429/5xx with exponential backoff, 3 attempts. Anything else
 * surfaces immediately.
 */

import type { RoundLogger } from "./log/round-logger";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
const MAX_RETRIES = 6;
const RETRY_BASE_MS = 2000;
// Web-search-enabled Opus turns can take several minutes (multiple search
// fetches + a long structured-output draft). Push the per-call ceiling well
// past the 3-minute Cloudflare gateway default so we don't false-abort.
const TIMEOUT_MS = 600_000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  /** Optional logger — caller passes in for per-turn observability. */
  logger?: RoundLogger;
  /** Optional agent role for tagging log events. */
  agentRole?: string;
  /**
   * When true, attaches Anthropic's server-side `web_search_20250305` tool
   * to the request. The model can issue web queries during reasoning;
   * Anthropic runs the searches and inlines results inside the same turn,
   * so no client-side tool_use loop is required and `text` still contains
   * the model's final structured-output draft.
   *
   * Per-call cap is `webSearchMaxUses` (default 8). We log every search
   * the model issues via the `web_search_use` event for downstream audit.
   */
  useWebSearch?: boolean;
  /** Per-call cap on web_search invocations. Defaults to 8. */
  webSearchMaxUses?: number;
}

export interface ChatResponse {
  text: string;
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number };
  raw: unknown;
}

export class AnthropicClient {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error("AnthropicClient: ANTHROPIC_API_KEY is required");
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    req.logger?.event("agent_input", {
      agent: req.agentRole ?? "unknown",
      model: req.model,
      system: req.system,
      messages: req.messages,
      useWebSearch: !!req.useWebSearch,
    });

    const tools = req.useWebSearch
      ? [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: req.webSearchMaxUses ?? 8,
          },
        ]
      : undefined;

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature ?? 1,
      system: req.system,
      messages: req.messages,
    };
    if (tools) body.tools = tools;

    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt < MAX_RETRIES) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
        });
        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          if (attempt >= MAX_RETRIES) {
            const txt = await res.text().catch(() => "");
            throw new Error(
              `Anthropic ${res.status} after ${MAX_RETRIES} attempts: ${txt.slice(0, 300)}`,
            );
          }
          const wait = RETRY_BASE_MS * 2 ** (attempt - 1);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const json = await res.json();
        if (!res.ok) {
          throw new Error(`Anthropic ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
        }
        const text = Array.isArray(json.content)
          ? json.content
              .filter((c: any) => c?.type === "text")
              .map((c: any) => c.text)
              .join("\n")
          : "";
        // Server-side web_search tool surfaces as `server_tool_use` /
        // `web_search_tool_result` content blocks. Log each query the model
        // ran so the round log preserves a full audit of external grounding.
        if (Array.isArray(json.content) && req.useWebSearch) {
          for (const block of json.content) {
            if (block?.type === "server_tool_use" && block?.name === "web_search") {
              req.logger?.event("web_search_use", {
                agent: req.agentRole ?? "unknown",
                query: block?.input?.query,
                toolUseId: block?.id,
              });
            } else if (block?.type === "web_search_tool_result") {
              const resultsArr = Array.isArray(block?.content) ? block.content : [];
              const results = resultsArr
                .filter((r: any) => r?.type === "web_search_result")
                .map((r: any) => ({ url: r?.url, title: r?.title, age: r?.page_age }));
              req.logger?.event("web_search_result", {
                agent: req.agentRole ?? "unknown",
                toolUseId: block?.tool_use_id,
                count: results.length,
                results,
              });
            }
          }
        }
        const out: ChatResponse = {
          text,
          stopReason: json.stop_reason,
          usage: {
            inputTokens: json.usage?.input_tokens ?? 0,
            outputTokens: json.usage?.output_tokens ?? 0,
          },
          raw: json,
        };
        req.logger?.event("agent_raw_output", {
          agent: req.agentRole ?? "unknown",
          model: req.model,
          text,
          stopReason: out.stopReason,
          usage: out.usage,
        });
        return out;
      } catch (err) {
        lastErr = err;
        if (attempt >= MAX_RETRIES) break;
        await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(
      `Anthropic chat failed after ${MAX_RETRIES} attempts: ${(lastErr as Error)?.message ?? String(lastErr)}`,
    );
  }
}

/**
 * Extract the first JSON object/array embedded in an LLM text response.
 * Handles ```json fenced blocks AND bare leading objects. Throws if no
 * parseable JSON span is found — caller should retry the agent with the
 * error appended.
 */
export function extractJson(raw: string): unknown {
  const fenceMatch = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }
  // Find the first { or [ and parse from there.
  const firstObj = raw.indexOf("{");
  const firstArr = raw.indexOf("[");
  let start = -1;
  if (firstObj >= 0 && (firstArr < 0 || firstObj < firstArr)) start = firstObj;
  else if (firstArr >= 0) start = firstArr;
  if (start < 0) {
    throw new Error("extractJson: no JSON object or array found in response");
  }
  // Try to parse progressively — find the matching closer by attempting
  // increasingly large suffixes ending in } or ].
  const slice = raw.slice(start);
  for (let i = slice.length; i > 0; i--) {
    const last = slice[i - 1];
    if (last !== "}" && last !== "]") continue;
    try {
      return JSON.parse(slice.slice(0, i));
    } catch { /* keep shrinking */ }
  }
  throw new Error("extractJson: found JSON-like start but could not parse a balanced span");
}
