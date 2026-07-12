/**
 * scripts/mintMcpToken.ts — WS-3 ops CLI
 *
 * Issues a scoped Ludics JWT for an MCP agent or operator.
 *
 * Usage:
 *   npx tsx scripts/mintMcpToken.ts \
 *     --deliberation <id> \
 *     --participant  <id> \
 *     [--ttl 3600]
 *
 * Requires LUDICS_JWT_SIGNING_KEY (and optionally LUDICS_JWT_ISSUER) in env.
 * The token is printed to stdout on a single line; copy it into the
 * `Authorization: Bearer <token>` header.
 */

import "dotenv/config";
import { issueScopedToken } from "@/server/ludics/auth";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const deliberationId = args.deliberation;
  const participantId = args.participant;
  const ttlRaw = args.ttl;

  if (!deliberationId || !participantId) {
    // eslint-disable-next-line no-console
    console.error(
      "Usage: tsx scripts/mintMcpToken.ts --deliberation <id> --participant <id> [--ttl 3600]",
    );
    process.exit(2);
  }
  if (!process.env.LUDICS_JWT_SIGNING_KEY) {
    // eslint-disable-next-line no-console
    console.error(
      "LUDICS_JWT_SIGNING_KEY is not set. Add it to .env (openssl rand -base64 48) before minting.",
    );
    process.exit(2);
  }

  const ttlSeconds = ttlRaw ? Math.max(1, Math.floor(Number(ttlRaw))) : undefined;
  if (ttlRaw && Number.isNaN(Number(ttlRaw))) {
    // eslint-disable-next-line no-console
    console.error(`--ttl must be a positive integer (got ${ttlRaw})`);
    process.exit(2);
  }

  const token = await issueScopedToken({
    deliberationId,
    participantId,
    ttlSeconds,
  });
  // eslint-disable-next-line no-console
  console.log(token);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
