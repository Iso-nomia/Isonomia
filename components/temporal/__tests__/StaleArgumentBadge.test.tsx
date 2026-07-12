import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StaleArgumentBadge } from "../../arguments/StaleArgumentBadge";

describe("StaleArgumentBadge", () => {
  const now = new Date();

  it("does not render for recent arguments (< 7 days)", () => {
    const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const { container } = render(<StaleArgumentBadge lastUpdatedAt={recentDate} />);
    
    expect(container.firstChild).toBeNull();
  });

  it("renders warning badge for moderately stale arguments (30-90 days)", () => {
    const staleDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
    render(<StaleArgumentBadge lastUpdatedAt={staleDate} />);

    expect(screen.getByText(/days ago/i)).toBeInTheDocument();
  });

  it("renders critical badge for very stale arguments (> 90 days)", () => {
    const criticalDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000); // 120 days ago
    render(<StaleArgumentBadge lastUpdatedAt={criticalDate} />);

    expect(screen.getByText(/Critically Stale/i)).toBeInTheDocument();
  });

  it("displays decay factor", () => {
    const staleDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago (half-life)
    render(<StaleArgumentBadge lastUpdatedAt={staleDate} />);

    // At half-life (90 days), decay factor should be ~0.5
    expect(screen.getByText(/0\.[45]/)).toBeInTheDocument();
  });

  it("displays days since update", () => {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    render(<StaleArgumentBadge lastUpdatedAt={thirtyDaysAgo} />);

    expect(screen.getByText(/30 days ago/i)).toBeInTheDocument();
  });

  it("accepts custom decay configuration", () => {
    const staleDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    render(
      <StaleArgumentBadge
        lastUpdatedAt={staleDate}
        decayConfig={{ halfLife: 30, minConfidence: 0.2 }}
      />
    );

    // With half-life of 30 days, 60 days should show much lower decay factor
    expect(screen.getByText(/days ago/i)).toBeInTheDocument();
  });

  it("shows appropriate severity styling for warning level", () => {
    const warningDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const { container } = render(<StaleArgumentBadge lastUpdatedAt={warningDate} />);

    const badge = container.querySelector("[class*='bg-yellow']");
    expect(badge).toBeInTheDocument();
  });

  it("shows appropriate severity styling for critical level", () => {
    const criticalDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    const { container } = render(<StaleArgumentBadge lastUpdatedAt={criticalDate} />);

    const badge = container.querySelector("[class*='bg-red']");
    expect(badge).toBeInTheDocument();
  });

  it("handles string date input", () => {
    const dateString = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
    render(<StaleArgumentBadge lastUpdatedAt={dateString} />);

    expect(screen.getByText(/days ago/i)).toBeInTheDocument();
  });

  it("displays decay factor with two decimal places", () => {
    const staleDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    render(<StaleArgumentBadge lastUpdatedAt={staleDate} />);

    // Should display formatted decay factor (e.g., "0.63")
    const decayText = screen.getByText(/0\.\d{2}/);
    expect(decayText).toBeInTheDocument();
  });
});
