import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DialogueStateBadge } from "../DialogueStateBadge";

// Mock fetch API
global.fetch = jest.fn();

describe("DialogueStateBadge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders complete status when all attacks answered", () => {
    render(
      <DialogueStateBadge
        deliberationId="delib123"
        argumentId="arg456"
        initialState={{
          totalAttacks: 3,
          answeredAttacks: 3,
          moveComplete: true,
        }}
      />
    );

    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(screen.getByTitle("3/3 attacks answered")).toBeInTheDocument();
    // Verify green color class for complete status
    const badge = screen.getByText("3/3").closest("div");
    expect(badge).toHaveClass("bg-green-100");
  });

  it("displays partial status when some attacks answered", () => {
    render(
      <DialogueStateBadge
        deliberationId="delib123"
        argumentId="arg456"
        initialState={{
          totalAttacks: 5,
          answeredAttacks: 2,
          moveComplete: false,
        }}
      />
    );

    expect(screen.getByText("2/5")).toBeInTheDocument();
    const badge = screen.getByText("2/5").closest("div");
    expect(badge).toHaveClass("bg-yellow-100");
  });

  it("displays pending status when no attacks answered", () => {
    render(
      <DialogueStateBadge
        deliberationId="delib123"
        argumentId="arg456"
        initialState={{
          totalAttacks: 4,
          answeredAttacks: 0,
          moveComplete: false,
        }}
      />
    );

    expect(screen.getByText("0/4")).toBeInTheDocument();
    const badge = screen.getByText("0/4").closest("div");
    expect(badge).toHaveClass("bg-red-100");
  });

  it("fetches dialogue state if not provided", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: { totalAttacks: 1, answeredAttacks: 0, moveComplete: false },
      }),
    });

    render(
      <DialogueStateBadge deliberationId="delib123" argumentId="arg456" />
    );

    await waitFor(() => {
      expect(screen.getByText("0/1")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/deliberations/delib123/dialogue-state?argumentId=arg456"
    );
  });

  it("displays error message on fetch failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(
      <DialogueStateBadge deliberationId="delib123" argumentId="arg456" />
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    render(
      <DialogueStateBadge deliberationId="delib123" argumentId="arg456" />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("handles zero total attacks gracefully", () => {
    render(
      <DialogueStateBadge
        deliberationId="delib123"
        argumentId="arg456"
        initialState={{
          totalAttacks: 0,
          answeredAttacks: 0,
          moveComplete: true,
        }}
      />
    );

    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByTitle("No attacks to answer")).toBeInTheDocument();
  });
});
