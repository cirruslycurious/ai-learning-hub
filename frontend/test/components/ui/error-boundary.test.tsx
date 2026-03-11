import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../../../src/components/ui/error-boundary";

afterEach(cleanup);

// Suppress React error boundary console errors during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function ThrowingComponent({ message }: { message: string }) {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Working content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("Working content")).toBeInTheDocument();
  });

  it("catches thrown error and shows error message", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test explosion" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
  });

  it("shows a 'Try again' button that resets the error state", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error("Temporary error");
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText("Temporary error")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /try again/i });
    expect(buttons.length).toBeGreaterThan(0);

    shouldThrow = false;
    await user.click(buttons[0]);

    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent message="Callback test" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Callback test" }),
      expect.any(Object)
    );
  });

  it("retry button is keyboard accessible", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error("Keyboard test");
      return <div>Keyboard recovered</div>;
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );

    const buttons = screen.getAllByRole("button", { name: /try again/i });
    buttons[0].focus();
    expect(buttons[0]).toHaveFocus();

    shouldThrow = false;
    await user.keyboard("{Enter}");

    expect(screen.getByText("Keyboard recovered")).toBeInTheDocument();
  });
});
