import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Skeleton } from "../../../src/components/ui/skeleton";

afterEach(cleanup);

describe("Skeleton", () => {
  it("renders with pulse animation class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("renders with rounded-md class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("rounded-md");
  });

  it("renders with bg-muted class", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass("bg-muted");
  });

  it("accepts custom className", () => {
    const { container } = render(<Skeleton className="w-20 h-4" />);
    expect(container.firstChild).toHaveClass("w-20");
    expect(container.firstChild).toHaveClass("h-4");
  });
});
