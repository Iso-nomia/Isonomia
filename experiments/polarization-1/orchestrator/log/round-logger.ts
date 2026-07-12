/**
 * orchestrator/log/round-logger.ts
 *
 * JSONL logger. One file per (phase, round, agent). Every event becomes a
 * single line so logs are grep-able, jq-queryable, and replayable.
 *
 * Events follow the shape:
 *   { ts: ISO, kind: <discriminator>, ...payload }
 *
 * The logger is lazy: it opens the file on first write, appends, and flushes
 * synchronously after each line. Loss-on-crash is bounded to one event.
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

export type LogKind =
  | "agent_input"
  | "agent_raw_output"
  | "agent_parsed_output"
  | "agent_validation_failure"
  | "agent_retry"
  | "isonomia_call"
  | "isonomia_error"
  | "review_flag"
  | "round_summary"
  | "phase_start"
  | "phase_complete"
  | "preflight";

export interface LogEvent {
  ts: string;
  kind: LogKind;
  [k: string]: unknown;
}

export class RoundLogger {
  private filePath: string;
  private opened = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  static forRound(opts: {
    runtimeDir: string;
    phase: number;
    round: number;
    agentRole?: string;
  }): RoundLogger {
    const slug = opts.agentRole ? `-${opts.agentRole}` : "";
    const file = path.join(
      opts.runtimeDir,
      "logs",
      `round-${opts.phase}-${opts.round}${slug}.jsonl`,
    );
    return new RoundLogger(file);
  }

  private ensureOpen() {
    if (this.opened) return;
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.opened = true;
  }

  event(kind: LogKind, payload: Record<string, unknown> = {}) {
    this.ensureOpen();
    const line: LogEvent = { ts: new Date().toISOString(), kind, ...payload };
    appendFileSync(this.filePath, JSON.stringify(line) + "\n");
  }

  /**
   * Append an event to a separate file (used for cross-round flag streams
   * like `review_flags.jsonl`).
   */
  static appendTo(filePath: string, kind: LogKind, payload: Record<string, unknown> = {}) {
    if (!existsSync(path.dirname(filePath))) {
      mkdirSync(path.dirname(filePath), { recursive: true });
    }
    const line: LogEvent = { ts: new Date().toISOString(), kind, ...payload };
    appendFileSync(filePath, JSON.stringify(line) + "\n");
  }
}
