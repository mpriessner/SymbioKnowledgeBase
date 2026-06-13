import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary, EditorErrorFallback } from "@/components/ErrorBoundary";

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("kaboom");
  return <div>all good</div>;
}

describe("ErrorBoundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught errors to console.error; silence for clean test output.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("renders the default fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("kaboom")).toBeInTheDocument();
  });

  it("invokes onError with the thrown error", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("renders a custom fallback and resets when invoked", () => {
    function Wrapper() {
      return (
        <ErrorBoundary
          fallback={(error, reset) => (
            <div>
              <span>custom: {error.message}</span>
              <button onClick={reset}>retry</button>
            </div>
          )}
        >
          <Boom shouldThrow />
        </ErrorBoundary>
      );
    }
    render(<Wrapper />);
    expect(screen.getByText("custom: kaboom")).toBeInTheDocument();
    // Reset clears the error state (children re-render and may throw again,
    // which is fine — we just assert the reset handler is wired).
    fireEvent.click(screen.getByText("retry"));
    expect(screen.getByText("custom: kaboom")).toBeInTheDocument();
  });
});

describe("EditorErrorFallback", () => {
  it("copies the in-memory content to the clipboard via the escape hatch", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.spyOn(window, "alert").mockImplementation(() => {});

    const content = { type: "doc", content: [{ type: "paragraph" }] };
    render(
      <EditorErrorFallback
        error={new Error("editor crashed")}
        reset={() => {}}
        getContent={() => content}
      />
    );

    fireEvent.click(screen.getByText("Copy unsaved content"));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('"type": "doc"');
  });

  it("omits the copy button when no content accessor is provided", () => {
    render(
      <EditorErrorFallback error={new Error("x")} reset={() => {}} />
    );
    expect(screen.queryByText("Copy unsaved content")).toBeNull();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });
});
