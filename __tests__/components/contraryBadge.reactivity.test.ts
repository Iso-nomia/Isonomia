/**
 * @jest-environment jsdom
 *
 * Phase D-1, Task 18: badge reactivity tests.
 *
 * These tests exercise the `useContraryCount` hook that powers `<ContraryBadge>`
 * and the `<ClaimContraryManager>` existing-relations list. We validate:
 *
 *   1. The pure normalizer (`normalizeContraries`) produces correct
 *      direction-aware items for both outgoing and incoming relations,
 *      and skips non-ACTIVE rows.
 *   2. The hook re-fetches when a `contraries:changed` window event is
 *      dispatched for the matching deliberation/claim, including events
 *      with no detail (treat as broad invalidation) and ignoring events
 *      scoped to a different claim.
 *
 * Rationale: this is the contract every consumer of the badge depends on.
 * If it breaks, every contrary surface (badge, manager, dialog, graph
 * overlay) silently drifts out of sync after a create/delete.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useContraryCount,
  normalizeContraries,
  type RawContrary,
} from "@/components/claims/contraryBadge/useContraryCount";

function makeRow(over: Partial<RawContrary>): RawContrary {
  return {
    id: "cc1",
    claimId: "c1",
    contraryId: "c2",
    isSymmetric: true,
    status: "ACTIVE",
    reason: null,
    createdAt: "2025-01-01T00:00:00Z",
    claim: { id: "c1", text: "P" },
    contrary: { id: "c2", text: "not P" },
    createdBy: { id: "42", username: "alice" },
    ...over,
  };
}

describe("normalizeContraries", () => {
  test("filters out non-ACTIVE rows", () => {
    const items = normalizeContraries("c1", [
      makeRow({ id: "a", status: "ACTIVE" }),
      makeRow({ id: "b", status: "RETRACTED" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("a");
  });

  test("tags outgoing direction when focal === claimId", () => {
    const [item] = normalizeContraries(
      "c1",
      [makeRow({ claimId: "c1", contraryId: "c2", contrary: { id: "c2", text: "Q" } })]
    );
    expect(item.direction).toBe("outgoing");
    expect(item.otherId).toBe("c2");
    expect(item.otherText).toBe("Q");
  });

  test("tags incoming direction when focal === contraryId", () => {
    const [item] = normalizeContraries("c2", [
      makeRow({
        claimId: "c1",
        contraryId: "c2",
        claim: { id: "c1", text: "P" },
        contrary: { id: "c2", text: "Q" },
      }),
    ]);
    expect(item.direction).toBe("incoming");
    expect(item.otherId).toBe("c1");
    expect(item.otherText).toBe("P");
  });

  test("falls back to 'Unknown claim' when text is missing", () => {
    const [item] = normalizeContraries("c1", [
      makeRow({
        claimId: "c1",
        contraryId: "c2",
        contrary: { id: "c2", text: "" },
      }),
    ]);
    // Empty string still goes through ?? "Unknown claim" only when
    // value is null/undefined; explicit "" should be preserved.
    expect(item.otherText).toBe("");

    const [item2] = normalizeContraries("c1", [
      makeRow({
        claimId: "c1",
        contraryId: "c2",
        contrary: undefined as unknown as RawContrary["contrary"],
      }),
    ]);
    expect(item2.otherText).toBe("Unknown claim");
  });
});

describe("useContraryCount reactivity", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ contraries: [] }),
    })) as unknown as jest.Mock;
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("does not fetch when disabled", () => {
    renderHook(() =>
      useContraryCount({
        deliberationId: "d1",
        claimId: "c1",
        enabled: false,
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("fetches once on mount when enabled", async () => {
    renderHook(() =>
      useContraryCount({ deliberationId: "d1", claimId: "c1" })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("deliberationId=d1");
    expect(url).toContain("claimId=c1");
  });

  test("re-fetches on contraries:changed event scoped to this claim", async () => {
    renderHook(() =>
      useContraryCount({ deliberationId: "d1", claimId: "c1" })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("contraries:changed", {
          detail: { deliberationId: "d1", claimId: "c1" },
        })
      );
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  test("re-fetches on detail-less contraries:changed (broad invalidation)", async () => {
    renderHook(() =>
      useContraryCount({ deliberationId: "d1", claimId: "c1" })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new CustomEvent("contraries:changed"));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  test("ignores contraries:changed for a different claim", async () => {
    renderHook(() =>
      useContraryCount({ deliberationId: "d1", claimId: "c1" })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("contraries:changed", {
          detail: { deliberationId: "d1", claimId: "OTHER" },
        })
      );
    });
    // Give any potential refetch a tick to land; assert it didn't.
    await new Promise((r) => setTimeout(r, 25));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("normalizes fetched rows to outgoing/incoming items", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        contraries: [
          makeRow({ id: "out", claimId: "c1", contraryId: "c2" }),
          makeRow({ id: "in", claimId: "c0", contraryId: "c1" }),
          makeRow({ id: "skip", status: "RETRACTED", claimId: "c1" }),
        ],
      }),
    });

    const { result } = renderHook(() =>
      useContraryCount({ deliberationId: "d1", claimId: "c1" })
    );

    await waitFor(() => expect(result.current.count).toBe(2));
    expect(result.current.outgoing.map((i) => i.id)).toEqual(["out"]);
    expect(result.current.incoming.map((i) => i.id)).toEqual(["in"]);
  });
});
