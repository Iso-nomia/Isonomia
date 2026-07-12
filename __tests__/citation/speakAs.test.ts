/**
 * S3 — the §4 participant/side shim + the non-negotiable human-impersonation
 * floor: an MCP `speakAs` can never resolve to, collide with, or impersonate a
 * human participant's `auth_id`; a human can never forge the service-identity
 * prefix. Pure-function tests over lib/citation/mcpAuth.
 */
import { describe, test, expect } from "@jest/globals";
import { namespaceForSpeakAs, normalizeSpeakAs } from "@/lib/citation/mcpAuth";

const SERVICE = "mcp-bot";

describe("normalizeSpeakAs", () => {
  test("passes through a clean label", () => {
    expect(normalizeSpeakAs("proponent")).toBe("proponent");
  });
  test("empty / whitespace / nullish → 'default'", () => {
    expect(normalizeSpeakAs("")).toBe("default");
    expect(normalizeSpeakAs("   ")).toBe("default");
    expect(normalizeSpeakAs(undefined)).toBe("default");
    expect(normalizeSpeakAs(null)).toBe("default");
  });
  test("strips characters that could inject an extra id segment (incl. ':')", () => {
    // ':' is not in the allowed set → cannot smuggle a second path segment.
    expect(normalizeSpeakAs("mcp-bot:alice")).toBe("mcp-botalice");
    expect(normalizeSpeakAs("opp/../onent")).toBe("opp..onent");
    expect(normalizeSpeakAs("side one")).toBe("sideone");
  });
  test("clamps to 64 chars", () => {
    expect(normalizeSpeakAs("x".repeat(200))).toHaveLength(64);
  });
});

describe("namespaceForSpeakAs — MCP bearer", () => {
  test("namespaces into distinct sides under the service identity", () => {
    expect(
      namespaceForSpeakAs({ isMcpBearer: true, baseUserId: SERVICE, speakAs: "proponent" }),
    ).toBe("mcp-bot:proponent");
    expect(
      namespaceForSpeakAs({ isMcpBearer: true, baseUserId: SERVICE, speakAs: "opponent" }),
    ).toBe("mcp-bot:opponent");
  });

  test("no speakAs → bare service identity (side is opt-in)", () => {
    expect(
      namespaceForSpeakAs({ isMcpBearer: true, baseUserId: SERVICE, speakAs: undefined }),
    ).toBe("mcp-bot");
    expect(
      namespaceForSpeakAs({ isMcpBearer: true, baseUserId: SERVICE, speakAs: "  " }),
    ).toBe("mcp-bot");
  });

  test("every MCP-resolved id starts with the service identity (floor)", () => {
    // Either the bare service id (no side) or `service:side` — never a human id.
    for (const s of ["proponent", "opponent", "", "weird value!!", "alice"]) {
      const id = namespaceForSpeakAs({ isMcpBearer: true, baseUserId: SERVICE, speakAs: s });
      expect(id === SERVICE || id.startsWith(`${SERVICE}:`)).toBe(true);
    }
  });
});

describe("namespaceForSpeakAs — human / cookie caller (the floor)", () => {
  test("speakAs is ignored: a human is always their own raw id", () => {
    expect(
      namespaceForSpeakAs({ isMcpBearer: false, baseUserId: "alice", speakAs: "proponent" }),
    ).toBe("alice");
  });

  test("a human can NEVER forge the service-identity prefix", () => {
    const id = namespaceForSpeakAs({ isMcpBearer: false, baseUserId: "alice", speakAs: "mcp-bot" });
    expect(id).toBe("alice");
    expect(id.startsWith("mcp-bot:")).toBe(false);
  });

  test("an MCP speakAs colliding with a human auth_id resolves to the bot side, not the human", () => {
    // Human 'alice' exists; an MCP caller tries speakAs='alice'.
    const human = namespaceForSpeakAs({ isMcpBearer: false, baseUserId: "alice", speakAs: "x" });
    const botImpersonation = namespaceForSpeakAs({
      isMcpBearer: true,
      baseUserId: SERVICE,
      speakAs: "alice",
    });
    expect(botImpersonation).toBe("mcp-bot:alice");
    expect(botImpersonation).not.toBe(human); // cannot land in alice's ledger
  });
});
