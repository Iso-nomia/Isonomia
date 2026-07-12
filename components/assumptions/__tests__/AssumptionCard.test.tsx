import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AssumptionCard } from "../AssumptionCard";

// Mock fetch API
global.fetch = jest.fn();

const mockAssumptionProps = {
  id: "assumption-123",
  assumptionText: "Test assumption content",
  role: "BACKGROUND",
  status: "PROPOSED" as const,
  statusChangedAt: new Date("2025-01-15T10:00:00Z"),
  statusChangedBy: "user-789",
  challengeReason: null,
  weight: 0.8,
  confidence: 0.7,
};

describe("AssumptionCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders assumption content and metadata", () => {
    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={jest.fn()} />
    );

    expect(screen.getByText("Test assumption content")).toBeInTheDocument();
    expect(screen.getByText("PROPOSED")).toBeInTheDocument();
    expect(screen.getByText("BACKGROUND")).toBeInTheDocument();
  });

  it("displays Accept and Challenge buttons for PROPOSED status", () => {
    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={jest.fn()} />
    );

    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Challenge")).toBeInTheDocument();
  });

  it("displays Retract button for ACCEPTED status", () => {
    const acceptedProps = {
      ...mockAssumptionProps,
      status: "ACCEPTED" as const,
    };

    render(
      <AssumptionCard {...acceptedProps} onStatusChange={jest.fn()} />
    );

    expect(screen.getByText("Retract")).toBeInTheDocument();
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
  });

  it("calls accept API when Accept button clicked", async () => {
    const onStatusChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={onStatusChange} />
    );

    const acceptButton = screen.getByText("Accept");
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/assumptions/assumption-123/accept",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(onStatusChange).toHaveBeenCalled();
    });
  });

  it("shows challenge form when Challenge button clicked", () => {
    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={jest.fn()} />
    );

    const challengeButton = screen.getByText("Challenge");
    fireEvent.click(challengeButton);

    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument();
    expect(screen.getByText("Submit Challenge")).toBeInTheDocument();
  });

  it("submits challenge with reason", async () => {
    const onStatusChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={onStatusChange} />
    );

    const challengeButton = screen.getByText("Challenge");
    fireEvent.click(challengeButton);

    const reasonInput = screen.getByPlaceholderText(/reason/i);
    fireEvent.change(reasonInput, { target: { value: "Test reason" } });

    const submitButton = screen.getByText("Submit Challenge");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/assumptions/assumption-123/challenge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Test reason" }),
        })
      );
      expect(onStatusChange).toHaveBeenCalled();
    });
  });

  it("calls retract API when Retract button clicked", async () => {
    const acceptedProps = {
      ...mockAssumptionProps,
      status: "ACCEPTED" as const,
    };

    const onStatusChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <AssumptionCard {...acceptedProps} onStatusChange={onStatusChange} />
    );

    const retractButton = screen.getByText("Retract");
    fireEvent.click(retractButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/assumptions/assumption-123/retract",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(onStatusChange).toHaveBeenCalled();
    });
  });

  it("displays error message on API failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("API error")
    );

    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={jest.fn()} />
    );

    const acceptButton = screen.getByText("Accept");
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it("displays challenge reason for CHALLENGED status", () => {
    const challengedProps = {
      ...mockAssumptionProps,
      status: "CHALLENGED" as const,
      challengeReason: "This assumption is flawed because...",
    };

    render(
      <AssumptionCard {...challengedProps} onStatusChange={jest.fn()} />
    );

    expect(screen.getByText("CHALLENGED")).toBeInTheDocument();
    expect(
      screen.getByText("This assumption is flawed because...")
    ).toBeInTheDocument();
  });

  it("displays role badge with correct styling", () => {
    render(
      <AssumptionCard {...mockAssumptionProps} onStatusChange={jest.fn()} />
    );

    expect(screen.getByText("BACKGROUND")).toBeInTheDocument();
  });
});
