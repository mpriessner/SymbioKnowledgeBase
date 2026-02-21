import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraphTooltip } from "@/components/graph/GraphTooltip";

describe("GraphTooltip", () => {
  it("should render title and connection count when visible", () => {
    render(
      <GraphTooltip
        title="Test Page"
        linkCount={5}
        x={100}
        y={100}
        visible={true}
      />
    );
    expect(screen.getByText("Test Page")).toBeInTheDocument();
    expect(screen.getByText("5 connections")).toBeInTheDocument();
  });

  it("should render singular 'connection' for count of 1", () => {
    render(
      <GraphTooltip
        title="Test"
        linkCount={1}
        x={100}
        y={100}
        visible={true}
      />
    );
    expect(screen.getByText("1 connection")).toBeInTheDocument();
  });

  it("should not render when not visible", () => {
    const { container } = render(
      <GraphTooltip
        title="Test"
        linkCount={1}
        x={100}
        y={100}
        visible={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
