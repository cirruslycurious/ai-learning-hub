import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "../../../src/components/ui/badge";

afterEach(cleanup);

describe("Badge", () => {
  it("renders with text content", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it("renders default variant with primary colors", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").className).toContain("bg-primary");
  });

  it("renders secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText("Secondary").className).toContain("bg-secondary");
  });

  it("renders destructive variant", () => {
    render(<Badge variant="destructive">Error</Badge>);
    expect(screen.getByText("Error").className).toContain("bg-destructive");
  });

  it("renders outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText("Outline").className).toContain("text-foreground");
  });

  it("renders project status variants", () => {
    render(<Badge variant="exploring">Exploring</Badge>);
    expect(screen.getByText("Exploring").className).toContain("bg-muted");

    render(<Badge variant="building">Building</Badge>);
    expect(screen.getByText("Building").className).toContain("bg-accent-soft");

    render(<Badge variant="completed">Completed</Badge>);
    expect(screen.getByText("Completed").className).toContain("bg-brand-soft");

    render(<Badge variant="paused">Paused</Badge>);
    expect(screen.getByText("Paused").className).toContain("opacity-60");
  });

  it("renders tag variant", () => {
    render(<Badge variant="tag">Tag</Badge>);
    const el = screen.getByText("Tag");
    expect(el.className).toContain("border-border");
  });

  it("accepts custom className", () => {
    render(<Badge className="my-class">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("my-class");
  });
});
