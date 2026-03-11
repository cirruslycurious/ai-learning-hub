import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "../../src/components/ThemeToggle";

const setThemeMock = vi.fn();
let currentTheme = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: currentTheme,
    setTheme: setThemeMock,
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentTheme = "system";
});

describe("ThemeToggle", () => {
  it("renders a button with accessible label", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
  });

  it("cycles from system to light on click", async () => {
    const user = userEvent.setup();
    currentTheme = "system";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    await user.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("cycles from light to dark on click", async () => {
    const user = userEvent.setup();
    currentTheme = "light";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    await user.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("cycles from dark to system on click", async () => {
    const user = userEvent.setup();
    currentTheme = "dark";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    await user.click(button);
    expect(setThemeMock).toHaveBeenCalledWith("system");
  });

  it("is keyboard accessible with Enter", async () => {
    const user = userEvent.setup();
    currentTheme = "light";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    button.focus();
    await user.keyboard("{Enter}");
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});
