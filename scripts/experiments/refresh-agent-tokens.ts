/**
 * scripts/experiments/refresh-agent-tokens.ts
 *
 * Reads `experiments/polarization-1/runtime/agents.json`, refreshes any
 * tokens that are about to expire (or all of them if `--force`), and writes
 * the file back atomically. Idempotent — the orchestrator should call this
 * before each phase.
 *
 * Usage:
 *   yarn refresh:agents [--in PATH] [--force] [--threshold-seconds 300]
 */

import { readFileSync, writeFileSync, renameSync } from "fs";
import path from "path";

type AgentRecord = {
  role: string;
  userId: string;
  authId: string;
  displayName: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: string;
};

type RuntimeFile = {
  labelPrefix: string;
  provisionedAt: string;
  agents: AgentRecord[];
};

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function refreshOne(refreshToken: string): Promise<{
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}> {
  if (!FIREBASE_API_KEY) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY env var is required");
  }
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`refresh failed (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as {
    id_token: string;
    refresh_token: string;
    expires_in: string;
  };
  return {
    idToken: json.id_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inPath = path.resolve(args["in"] ?? "experiments/polarization-1/runtime/agents.json");
  const force = args["force"] === "true";
  const thresholdSeconds = Number(args["threshold-seconds"] ?? 300);

  const raw = readFileSync(inPath, "utf8");
  const data = JSON.parse(raw) as RuntimeFile;

  const now = Date.now();
  let refreshed = 0;
  for (const agent of data.agents) {
    const expiresAt = new Date(agent.expiresAt).getTime();
    const secondsLeft = Math.floor((expiresAt - now) / 1000);
    if (!force && secondsLeft > thresholdSeconds) {
      continue;
    }
    process.stdout.write(`refresh ${agent.role} (secondsLeft=${secondsLeft}) … `);
    const res = await refreshOne(agent.refreshToken);
    agent.idToken = res.idToken;
    agent.refreshToken = res.refreshToken;
    agent.expiresAt = new Date(now + Number(res.expiresIn) * 1000).toISOString();
    refreshed++;
    process.stdout.write("ok\n");
  }

  if (refreshed === 0) {
    console.log("All tokens are fresh; nothing to do.");
    return;
  }

  const tmp = `${inPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, inPath);
  console.log(`Refreshed ${refreshed}/${data.agents.length} tokens.`);
}

main().catch((err) => {
  console.error("[refresh-agent-tokens] failed:", err);
  process.exit(1);
});
