/**
 * Phase 10a (10.6) — HTTP contract for POST /api/webmention.
 * The verification/record helpers are unit-tested in lib/webmention.test.ts;
 * here we assert the route's flow: param validation → target resolution →
 * verification gate → 201 with the honest "unreviewed" note.
 */

import { NextRequest } from "next/server";

const parseTargetPath = jest.fn();
const resolveTargetId = jest.fn();
const verifyBacklink = jest.fn();
const recordExternalCitation = jest.fn();
const checkDomainRateLimit = jest.fn();

jest.mock("@/lib/citation/webmention", () => ({
  parseTargetPath,
  resolveTargetId,
  verifyBacklink,
  recordExternalCitation,
  checkDomainRateLimit,
}));

import { POST } from "@/app/api/webmention/route";

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/webmention", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  parseTargetPath.mockReset();
  resolveTargetId.mockReset();
  verifyBacklink.mockReset();
  recordExternalCitation.mockReset();
  checkDomainRateLimit.mockReset();
  checkDomainRateLimit.mockResolvedValue({ allowed: true, remaining: 19 });
});

it("400s when source or target is missing", async () => {
  const res = await post({ source: "https://blog.example/p" });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("source_and_target_required");
});

it("400s when the target is not one of our permalinks", async () => {
  parseTargetPath.mockReturnValue(null);
  const res = await post({ source: "https://blog.example/p", target: "https://evil/x" });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("target_not_supported");
});

it("400s when the backlink cannot be verified", async () => {
  parseTargetPath.mockReturnValue({ targetType: "argument", identifier: "SC1" });
  resolveTargetId.mockResolvedValue({ targetType: "argument", targetId: "arg1" });
  verifyBacklink.mockResolvedValue({ ok: false, title: null, reason: "no_backlink" });
  const res = await post({
    source: "https://blog.example/p",
    target: "https://isonomia.app/a/SC1",
  });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe("verification_failed");
  expect(body.reason).toBe("no_backlink");
  expect(recordExternalCitation).not.toHaveBeenCalled();
});

it("429s when the source domain is over its rate limit (before any fetch)", async () => {
  parseTargetPath.mockReturnValue({ targetType: "argument", identifier: "SC1" });
  resolveTargetId.mockResolvedValue({ targetType: "argument", targetId: "arg1" });
  checkDomainRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });
  const res = await post({
    source: "https://spam.example/p",
    target: "https://isonomia.app/a/SC1",
  });
  expect(res.status).toBe(429);
  expect((await res.json()).error).toBe("rate_limited");
  expect(verifyBacklink).not.toHaveBeenCalled();
});

it("records a verified backlink as unreviewed and 201s", async () => {
  parseTargetPath.mockReturnValue({ targetType: "argument", identifier: "SC1" });
  resolveTargetId.mockResolvedValue({ targetType: "argument", targetId: "arg1" });
  verifyBacklink.mockResolvedValue({ ok: true, title: "A post" });
  recordExternalCitation.mockResolvedValue({ id: "x1", trustState: "unreviewed" });
  const res = await post({
    source: "https://blog.example/p",
    target: "https://isonomia.app/a/SC1",
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, id: "x1", trustState: "unreviewed" });
  expect(recordExternalCitation).toHaveBeenCalledWith({
    targetType: "argument",
    targetId: "arg1",
    sourceUrl: "https://blog.example/p",
    title: "A post",
  });
});
