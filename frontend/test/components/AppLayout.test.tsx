import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "../../src/components/AppLayout";
import { AppProvider } from "../../src/lib/store";
import { TooltipProvider } from "../../src/components/ui/tooltip";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("test-token") }),
}));

afterEach(cleanup);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/app"]}>
        <TooltipProvider>
          <AppProvider>
            <AppLayout />
          </AppProvider>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AppLayout", () => {
  it("renders NavRail navigation elements", () => {
    renderWithProviders();
    // NavRail renders two nav elements (desktop + mobile)
    const navs = document.querySelectorAll("nav");
    expect(navs.length).toBe(2);
  });

  it("renders main content area", () => {
    renderWithProviders();
    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("renders mobile nav with Library and Projects labels", () => {
    renderWithProviders();
    // Mobile bottom nav shows text labels
    expect(screen.getAllByText("Library").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Projects").length).toBeGreaterThan(0);
  });
});
