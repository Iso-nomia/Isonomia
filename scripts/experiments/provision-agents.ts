/**
 * scripts/experiments/provision-agents.ts
 *
 * Provision N bot users for a multi-agent deliberation experiment.
 *
 * For each agent:
 *  1. Creates a Firebase Auth user with a deterministic email
 *     (idempotent — re-using existing user if email already exists)
 *  2. Upserts a Prisma `User` row with `kind = "bot"` and a stable role-based
 *     displayName (e.g. "Claim Analyst (bot)")
 *  3. Mints a long-lived Firebase custom token, exchanges it for an ID token
 *     + refresh token via the Firebase REST `signInWithCustomToken` endpoint
 *  4. Writes `runtime/agents.json` with `{ role, userId, displayName, idToken,
 *     refreshToken, expiresAt }[]`
 *
 * Re-run safely: existing Firebase users are reused, existing User rows are
 * upserted, and tokens are minted fresh on every run.
 *
 * Usage:
 *   yarn provision:agents \
 *     --label-prefix polarization-exp-1 \
 *     --out experiments/polarization-1/runtime/agents.json
 */

import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";

import { prisma } from "../../lib/prismaclient";
import { serverConfig } from "../../lib/firebase/config";

// ──────────────────────────────────────────────────────────────────────────────
// Roles + canonical display names
// ──────────────────────────────────────────────────────────────────────────────

const ROLES = [
  { role: "claim-analyst", displayName: "Claim Analyst (bot)" },
  { role: "advocate-a", displayName: "Advocate A (bot)" },
  { role: "advocate-b", displayName: "Advocate B (bot)" },
  { role: "challenger", displayName: "Challenger (bot)" },
  { role: "concession-tracker", displayName: "Concession Tracker (bot)" },
  { role: "methodologist", displayName: "Methodologist (bot)" },
] as const;

type Role = (typeof ROLES)[number]["role"];

// ──────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ──────────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────────
// Firebase Admin init (mirrors scripts/seed.ts)
// ──────────────────────────────────────────────────────────────────────────────

if (getApps().length === 0) {
  initializeApp({ credential: cert(serverConfig.serviceAccount) });
}

const auth = getAuth();

// ──────────────────────────────────────────────────────────────────────────────
// Custom-token → ID-token exchange via Firebase REST
// ──────────────────────────────────────────────────────────────────────────────

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function exchangeCustomTokenForIdToken(customToken: string): Promise<{
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}> {
  if (!FIREBASE_API_KEY) {
    throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY env var is required for token exchange");
  }
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`signInWithCustomToken failed (${res.status}): ${body}`);
  }
  const json = (await res.json()) as {
    idToken: string;
    refreshToken: string;
    expiresIn: string;
  };
  return json;
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-agent provisioning
// ──────────────────────────────────────────────────────────────────────────────

async function getOrCreateFirebaseUser(email: string, displayName: string): Promise<UserRecord> {
  try {
    return await auth.createUser({ email, displayName, emailVerified: false });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return await auth.getUserByEmail(email);
    }
    throw err;
  }
}

async function provisionOne(opts: {
  role: Role;
  displayName: string;
  email: string;
  username: string;
}): Promise<{
  role: Role;
  userId: string;
  authId: string;
  displayName: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: string;
}> {
  const { role, displayName, email, username } = opts;

  const fbUser = await getOrCreateFirebaseUser(email, displayName);

  // Stamp custom claims so server-side handlers can detect bot identities
  // without an extra DB lookup if they ever need to.
  await auth.setCustomUserClaims(fbUser.uid, { kind: "bot", role });

  // Upsert the Prisma User row.
  const dbUser = await prisma.user.upsert({
    where: { auth_id: fbUser.uid },
    update: {
      name: displayName,
      kind: "bot",
    },
    create: {
      auth_id: fbUser.uid,
      username,
      name: displayName,
      bio: `Automated agent (${role}) for multi-agent deliberation experiment.`,
      onboarded: true,
      kind: "bot",
    },
    select: { id: true, auth_id: true },
  });

  // Mint a custom token and immediately exchange it for an ID + refresh token.
  const customToken = await auth.createCustomToken(fbUser.uid, { kind: "bot", role });
  const exchanged = await exchangeCustomTokenForIdToken(customToken);

  const expiresAt = new Date(Date.now() + Number(exchanged.expiresIn) * 1000).toISOString();

  return {
    role,
    userId: dbUser.id.toString(),
    authId: dbUser.auth_id,
    displayName,
    email,
    idToken: exchanged.idToken,
    refreshToken: exchanged.refreshToken,
    expiresAt,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const labelPrefix = args["label-prefix"] ?? "polarization-exp-1";
  const outPath = path.resolve(
    args["out"] ?? "experiments/polarization-1/runtime/agents.json",
  );

  const emailDomain = "bots.isonomia.app";

  const results: Awaited<ReturnType<typeof provisionOne>>[] = [];
  for (let i = 0; i < ROLES.length; i++) {
    const { role, displayName } = ROLES[i];
    const agentNum = i + 1;
    const username = `${labelPrefix}-agent-${agentNum}`;
    const email = `${username}@${emailDomain}`;
    process.stdout.write(`[${agentNum}/${ROLES.length}] provisioning ${role} (${email}) … `);
    const res = await provisionOne({ role, displayName, email, username });
    results.push(res);
    process.stdout.write(`ok (userId=${res.userId})\n`);
  }

  // Write the runtime artifact.
  mkdirSync(path.dirname(outPath), { recursive: true });
  const payload = {
    labelPrefix,
    provisionedAt: new Date().toISOString(),
    agents: results,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(`\nWrote ${results.length} agent records to ${outPath}`);
  console.log("Reminder: this file contains bearer tokens; ensure runtime/ is gitignored.");
}

main()
  .catch((err) => {
    console.error("[provision-agents] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
