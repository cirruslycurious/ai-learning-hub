import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EmptyState } from "../../src/components/EmptyState";
import { AppProvider } from "../../src/lib/store";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

afterEach(cleanup);

function renderWithProviders(variant: "library" | "projects" | "search") {
  return render(
    <AppProvider>
      <EmptyState variant={variant} />
    </AppProvider>
  );
}

describe("EmptyState", () => {
  it("renders library variant with save CTA", () => {
    renderWithProviders("library");
    expect(screen.getByText(/Save anything you/)).toBeInTheDocument();
    expect(screen.getByText(/Save your first URL/)).toBeInTheDocument();
  });

  it("renders library variant with starter projects", () => {
    renderWithProviders("library");
    expect(screen.getByText("Build a Custom GPT")).toBeInTheDocument();
    expect(
      screen.getByText("AI Automation for Your Day Job")
    ).toBeInTheDocument();
    expect(screen.getByText("Build a RAG Pipeline")).toBeInTheDocument();
  });

  it("renders projects variant", () => {
    renderWithProviders("projects");
    expect(screen.getByText(/Projects connect your saves/)).toBeInTheDocument();
    expect(screen.getByText(/Create your first project/)).toBeInTheDocument();
  });

  it("renders search variant with no-results message", () => {
    renderWithProviders("search");
    expect(screen.getByText(/Nothing matches that/)).toBeInTheDocument();
  });
});
