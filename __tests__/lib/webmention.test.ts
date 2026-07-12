/**
 * Phase 10a (10.6) — unit tests for the Webmention pure helpers.
 * These are the security-critical pieces (SSRF classification, target parsing,
 * backlink detection) and are tested without any network access.
 */

jest.mock("@/lib/prismaclient", () => ({ prisma: {} }));
jest.mock("@/lib/citations/permalinkService", () => ({ resolvePermalink: jest.fn() }));

import { ipIsPrivate, parseTargetPath, htmlLinksTo } from "@/lib/citation/webmention";

describe("ipIsPrivate (SSRF guard)", () => {
  it("rejects loopback / private / link-local / metadata addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1", // v4-mapped loopback
    ]) {
      expect(ipIsPrivate(ip)).toBe(true);
    }
  });

  it("accepts public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(ipIsPrivate(ip)).toBe(false);
    }
  });

  it("treats an unparseable host as unsafe", () => {
    expect(ipIsPrivate("not-an-ip")).toBe(true);
  });
});

describe("parseTargetPath", () => {
  it("maps /a/{shortCode} (incl. content-hash pin) to an argument target", () => {
    expect(parseTargetPath("https://isonomia.app/a/Bx7kQ2mN")).toEqual({
      targetType: "argument",
      identifier: "Bx7kQ2mN",
    });
    expect(parseTargetPath("https://isonomia.app/a/Bx7kQ2mN@deadbeef")).toEqual({
      targetType: "argument",
      identifier: "Bx7kQ2mN",
    });
  });

  it("maps /c/{moid} to a claim target and tolerates www.", () => {
    expect(parseTargetPath("https://www.isonomia.app/c/moid123")).toEqual({
      targetType: "claim",
      identifier: "moid123",
    });
  });

  it("returns null for other hosts and non-permalink paths", () => {
    expect(parseTargetPath("https://evil.example/a/x")).toBeNull();
    expect(parseTargetPath("https://isonomia.app/settings")).toBeNull();
    expect(parseTargetPath("not a url")).toBeNull();
  });
});

describe("htmlLinksTo", () => {
  const target = "https://isonomia.app/a/SC1";

  it("accepts an href to the full URL or the path", () => {
    expect(htmlLinksTo(`<a href="https://isonomia.app/a/SC1">x</a>`, target)).toBe(true);
    expect(htmlLinksTo(`<a href="/a/SC1">x</a>`, target)).toBe(true);
  });

  it("rejects a bare mention in prose (no href/src)", () => {
    expect(htmlLinksTo(`I read https://isonomia.app/a/SC1 today`, target)).toBe(false);
  });

  it("rejects a link to a different argument", () => {
    expect(htmlLinksTo(`<a href="https://isonomia.app/a/OTHER">x</a>`, target)).toBe(false);
  });
});
