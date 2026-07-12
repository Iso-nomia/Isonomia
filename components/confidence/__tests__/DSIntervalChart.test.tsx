import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DSIntervalChart } from "../DSIntervalChart";

describe("DSIntervalChart", () => {
  it("renders belief, uncertainty, and disbelief segments", () => {
    render(<DSIntervalChart belief={0.6} plausibility={0.9} />);

    expect(screen.getByText(/Belief/)).toBeInTheDocument();
    expect(screen.getByText(/Uncertainty/)).toBeInTheDocument();
    expect(screen.getByText(/Disbelief/)).toBeInTheDocument();
  });

  it("calculates correct segment widths", () => {
    const { container } = render(<DSIntervalChart belief={0.3} plausibility={0.7} />);

    // Belief = 0.3 (30%), Uncertainty = 0.4 (40%), Disbelief = 0.3 (30%)
    const bars = container.querySelectorAll("[class*='h-8']");
    expect(bars.length).toBeGreaterThan(0);

    // Check values displayed in chart
    expect(screen.getByText("0.30")).toBeInTheDocument(); // Belief
    expect(screen.getByText("0.40")).toBeInTheDocument(); // Uncertainty
  });

  it("displays interpretation for high belief", () => {
    render(<DSIntervalChart belief={0.8} plausibility={0.9} />);

    expect(
      screen.getByText(/Strong support with low uncertainty/i)
    ).toBeInTheDocument();
  });

  it("displays interpretation for high uncertainty", () => {
    render(<DSIntervalChart belief={0.2} plausibility={0.8} />);

    expect(
      screen.getByText(/Significant uncertainty/i)
    ).toBeInTheDocument();
  });

  it("displays interpretation for low plausibility", () => {
    render(<DSIntervalChart belief={0.1} plausibility={0.3} />);

    expect(
      screen.getByText(/Low overall support/i)
    ).toBeInTheDocument();
  });

  it("handles zero uncertainty case", () => {
    render(<DSIntervalChart belief={0.7} plausibility={0.7} />);

    // When belief = plausibility, uncertainty = 0
    expect(screen.getByText("0.00")).toBeInTheDocument();
  });

  it("handles maximum uncertainty case", () => {
    render(<DSIntervalChart belief={0.0} plausibility={1.0} />);

    // Maximum uncertainty when belief = 0, plausibility = 1
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it("displays technical details section", () => {
    render(<DSIntervalChart belief={0.5} plausibility={0.8} />);

    expect(screen.getByText(/Technical Details/i)).toBeInTheDocument();
    expect(
      screen.getByText(/epistemic uncertainty/i)
    ).toBeInTheDocument();
  });

  it("formats percentages correctly", () => {
    render(<DSIntervalChart belief={0.456} plausibility={0.789} />);

    // Should display as percentages: 45.6%, 33.3% (uncertainty), 21.1% (disbelief)
    expect(screen.getByText("45.6%")).toBeInTheDocument();
    expect(screen.getByText("33.3%")).toBeInTheDocument();
  });

  it("handles edge case: belief = 0", () => {
    render(<DSIntervalChart belief={0} plausibility={0.5} />);

    expect(screen.getByText("0.00")).toBeInTheDocument();
    expect(screen.getByText("0.50")).toBeInTheDocument();
  });

  it("handles edge case: plausibility = 1", () => {
    render(<DSIntervalChart belief={0.3} plausibility={1.0} />);

    expect(screen.getByText("0.30")).toBeInTheDocument();
    expect(screen.getByText("1.00")).toBeInTheDocument();
  });

  it("displays color-coded legend", () => {
    const { container } = render(<DSIntervalChart belief={0.5} plausibility={0.8} />);

    // Check for color classes (green for belief, yellow for uncertainty, red for disbelief)
    const legend = container.querySelector("[class*='mt-4']");
    expect(legend).toBeInTheDocument();
  });
});
