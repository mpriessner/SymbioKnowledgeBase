import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GraphControls } from "@/components/graph/GraphControls";

describe("GraphControls", () => {
  const defaultProps = {
    filters: {
      afterDate: null,
      beforeDate: null,
      minLinkCount: 0,
      showLabels: true,
      showEdgeLabels: false,
    },
    onFilterChange: vi.fn(),
    onReset: vi.fn(),
    isFiltered: false,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFitToScreen: vi.fn(),
    onResetView: vi.fn(),
    nodeCount: 42,
    edgeCount: 67,
  };

  it("should render zoom control buttons", () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText("Zoom +")).toBeInTheDocument();
    expect(screen.getByText("Zoom -")).toBeInTheDocument();
    expect(screen.getByText("Fit")).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("should call zoom handlers on button click", () => {
    render(<GraphControls {...defaultProps} />);

    fireEvent.click(screen.getByText("Zoom +"));
    expect(defaultProps.onZoomIn).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Zoom -"));
    expect(defaultProps.onZoomOut).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Fit"));
    expect(defaultProps.onFitToScreen).toHaveBeenCalled();
  });

  it("should render stats", () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText("42 pages, 67 connections")).toBeInTheDocument();
  });

  it('should show "(filtered)" indicator when filters active', () => {
    render(<GraphControls {...defaultProps} isFiltered={true} />);
    expect(screen.getByText(/filtered/)).toBeInTheDocument();
  });

  it("should show Clear button when filters are active", () => {
    render(<GraphControls {...defaultProps} isFiltered={true} />);
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("should call onReset when Clear is clicked", () => {
    render(<GraphControls {...defaultProps} isFiltered={true} />);
    fireEvent.click(screen.getByText("Clear"));
    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it("should render label toggles", () => {
    render(<GraphControls {...defaultProps} />);
    expect(screen.getByText("Node labels")).toBeInTheDocument();
    expect(screen.getByText("Edge labels")).toBeInTheDocument();
  });
});
