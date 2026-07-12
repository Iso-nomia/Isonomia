import {
  hashAuthIdForRedaction,
  redactForPublicRead,
} from "../auth";

describe("hashAuthIdForRedaction", () => {
  it("returns 12 hex chars", () => {
    const h = hashAuthIdForRedaction("auth_alice");
    expect(h).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is deterministic", () => {
    expect(hashAuthIdForRedaction("auth_x")).toBe(hashAuthIdForRedaction("auth_x"));
  });

  it("differs for different inputs", () => {
    expect(hashAuthIdForRedaction("auth_a")).not.toBe(hashAuthIdForRedaction("auth_b"));
  });
});

describe("redactForPublicRead", () => {
  it("is a no-op when not publicReadOnly", () => {
    const obj = { authoredById: "auth_alice", retractedReasonText: "spam" };
    expect(redactForPublicRead(obj, { publicReadOnly: false })).toEqual(obj);
  });

  it("hashes author id fields", () => {
    const out = redactForPublicRead(
      { authoredById: "auth_alice", confirmedById: "auth_bob" },
      { publicReadOnly: true },
    );
    expect(out.authoredById).toBe(hashAuthIdForRedaction("auth_alice"));
    expect(out.confirmedById).toBe(hashAuthIdForRedaction("auth_bob"));
  });

  it("strips reason free-text fields", () => {
    const out = redactForPublicRead(
      { retractedReasonText: "I changed my mind", dismissedReasonText: "noise", id: "x" },
      { publicReadOnly: true },
    );
    expect(out).toEqual({ id: "x" });
  });

  it("truncates evidenceText to 140 chars + ellipsis", () => {
    const long = "a".repeat(500);
    const out = redactForPublicRead({ evidenceText: long }, { publicReadOnly: true }) as Record<
      string,
      unknown
    >;
    const t = out.evidenceText as string;
    expect(t.length).toBe(141);
    expect(t.endsWith("…")).toBe(true);
  });

  it("strips userId / authId from evidenceJson", () => {
    const out = redactForPublicRead(
      { evidenceJson: { userId: "auth_alice", quote: "hi" } },
      { publicReadOnly: true },
    ) as Record<string, unknown>;
    expect(out.evidenceJson).toEqual({ quote: "hi" });
  });

  it("strips *Text fields from payloadJson", () => {
    const out = redactForPublicRead(
      { payloadJson: { rationaleText: "secret", axisKey: "VALUE" } },
      { publicReadOnly: true },
    ) as Record<string, unknown>;
    expect(out.payloadJson).toEqual({ axisKey: "VALUE" });
  });

  it("recurses into snapshotJson tags array", () => {
    const out = redactForPublicRead(
      {
        snapshotJson: {
          tags: [
            { authoredById: "auth_x", evidenceText: "b".repeat(200) },
          ],
        },
      },
      { publicReadOnly: true },
    ) as Record<string, unknown>;
    const tags = (out.snapshotJson as Record<string, unknown>).tags as Array<
      Record<string, unknown>
    >;
    expect(tags[0].authoredById).toBe(hashAuthIdForRedaction("auth_x"));
    expect((tags[0].evidenceText as string).length).toBe(141);
  });
});
