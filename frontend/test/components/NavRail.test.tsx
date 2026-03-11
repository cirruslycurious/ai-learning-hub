import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NavRail } from "../../src/components/NavRail";
import { AppProvider } from "../../src/lib/store";
import { TooltipProvider } from "../../src/components/ui/tooltip";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

afterEach(cleanup);

function renderNavRail(path = "/app") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <AppProvider>
          <NavRail />
        </AppProvider>
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe("NavRail", () => {
  it("renders nav buttons (desktop + mobile)", () => {
    renderNavRail();
    // Mobile bottom nav shows first 4 items with text labels
    expect(screen.getAllByText("Save").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Search").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Library").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Projects").length).toBeGreaterThan(0);
  });

  it("renders desktop and mobile nav elements", () => {
    renderNavRail();
    const navs = document.querySelectorAll("nav");
    expect(navs.length).toBe(2); // Desktop rail + mobile bottom
  });

  it("highlights active Library item at /app", () => {
    renderNavRail("/app");
    // Mobile nav shows text "Library" with text-primary when active
    const libraryLabels = screen.getAllByText("Library");
    const activeParent = libraryLabels.find((el) =>
      el.closest("button")?.className.includes("text-primary")
    );
    expect(activeParent).toBeDefined();
  });

  it("highlights active Projects item at /projects", () => {
    renderNavRail("/projects");
    const projectsLabels = screen.getAllByText("Projects");
    const activeParent = projectsLabels.find((el) =>
      el.closest("button")?.className.includes("text-primary")
    );
    expect(activeParent).toBeDefined();
  });

  it("renders ThemeToggle button", () => {
    renderNavRail();
    expect(
      screen.getAllByRole("button", { name: /toggle theme/i }).length
    ).toBeGreaterThan(0);
  });

  it("Save button triggers action without error", async () => {
    const user = userEvent.setup();
    renderNavRail();
    const saveLabels = screen.getAllByText("Save");
    const saveButton = saveLabels[0].closest("button")!;
    await user.click(saveButton);
    // No error thrown = save modal state change worked
  });
});
