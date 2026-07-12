import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HomSetConfidencePanel } from "../HomSetConfidencePanel";

// Mock fetch API
global.fetch = jest.fn();

const mockHomSetResponse = {
  homSet: {
    direction: "incoming" as const,
    aggregateConfidence: 0.75,
    aggregateUncertainty: 0.15,
    edgeCount: 5,
    minConfidence: 0.5,
    maxConfidence: 0.9,
    morphisms: [
      {
        id: "morph1",
        sourceId: "arg1",
        targetId: "arg2",
        edgeType: "SUPPORT",
        confidence: 0.8,
      },
      {
        id: "morph2",
        sourceId: "arg3",
        targetId: "arg2",
        edgeType: "REBUT",
        confidence: 0.6,
      },
    ],
  },
};

describe("HomSetConfidencePanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("fetches and displays hom-set data", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText(/0\.75/)).toBeInTheDocument(); // Aggregate confidence
      expect(screen.getByText(/5 edges/i)).toBeInTheDocument();
    });
  });

  it("calls API with correct parameters", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(
      <HomSetConfidencePanel
        argumentId="arg456"
        direction="outgoing"
        edgeTypeFilter="SUPPORT"
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/arguments/arg456/hom-set?direction=outgoing&edgeType=SUPPORT"
      );
    });
  });

  it("displays aggregate metrics", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText(/Aggregate Confidence/i)).toBeInTheDocument();
      expect(screen.getByText(/0\.75/)).toBeInTheDocument();
      expect(screen.getByText(/0\.15/)).toBeInTheDocument(); // Uncertainty
    });
  });

  it("displays morphism list", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText(/SUPPORT/i)).toBeInTheDocument();
      expect(screen.getByText(/REBUT/i)).toBeInTheDocument();
      expect(screen.getByText(/0\.8/)).toBeInTheDocument();
      expect(screen.getByText(/0\.6/)).toBeInTheDocument();
    });
  });

  it("displays min and max confidence", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText(/Min.*0\.5/i)).toBeInTheDocument();
      expect(screen.getByText(/Max.*0\.9/i)).toBeInTheDocument();
    });
  });

  it("handles empty hom-set gracefully", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        homSet: {
          direction: "incoming",
          aggregateConfidence: 0,
          aggregateUncertainty: 0,
          edgeCount: 0,
          minConfidence: 0,
          maxConfidence: 0,
          morphisms: [],
        },
      }),
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText(/No morphisms/i)).toBeInTheDocument();
    });
  });

  it("displays error message on API failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("supports direction filtering", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="outgoing" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("direction=outgoing")
      );
    });
  });

  it("supports edge type filtering", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(
      <HomSetConfidencePanel
        argumentId="arg123"
        direction="incoming"
        edgeTypeFilter="REBUT"
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("edgeType=REBUT")
      );
    });
  });

  it("auto-loads data when autoLoad prop is true", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHomSetResponse,
    });

    render(
      <HomSetConfidencePanel
        argumentId="arg123"
        direction="incoming"
        autoLoad={true}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it("formats confidence values to 2 decimal places", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        homSet: {
          ...mockHomSetResponse.homSet,
          aggregateConfidence: 0.7546,
        },
      }),
    });

    render(<HomSetConfidencePanel argumentId="arg123" direction="incoming" />);

    await waitFor(() => {
      expect(screen.getByText("0.75")).toBeInTheDocument();
    });
  });
});
