import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockGetToken = vi.fn();

vi.mock("@clerk/clerk-react", () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: () => <button>Sign in</button>,
  UserButton: () => <div data-testid="user-button" />,
  useAuth: () => ({ getToken: mockGetToken }),
}));

import App from "../src/App";

afterEach(cleanup);

describe("App", () => {
  it("renders title", () => {
    render(<App />);
    expect(screen.getByText(/AI Learning Hub/)).toBeInTheDocument();
  });

  it("copies JWT to clipboard when Copy JWT is clicked", async () => {
    const user = userEvent.setup();
    mockGetToken.mockResolvedValue("test-jwt-token");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<App />);
    await user.click(screen.getByText("Copy JWT"));

    expect(mockGetToken).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("test-jwt-token");
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("does not copy when getToken returns null", async () => {
    const user = userEvent.setup();
    mockGetToken.mockResolvedValue(null);
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<App />);
    await user.click(screen.getByText("Copy JWT"));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByText("Copy JWT")).toBeInTheDocument();
  });
});
