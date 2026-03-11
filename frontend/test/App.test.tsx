import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@clerk/clerk-react", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RedirectToSignIn: () => <div data-testid="redirect-to-sign-in" />,
  SignInButton: () => <button>Sign in</button>,
  UserButton: () => <div data-testid="user-button" />,
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("test-token") }),
}));

import App from "../src/App";

afterEach(cleanup);

describe("App", () => {
  it("renders the homepage with the product tagline", () => {
    render(<App />);
    expect(screen.getByText(/Save what you find/)).toBeInTheDocument();
  });

  it("renders the hero CTA", () => {
    render(<App />);
    expect(screen.getByText(/Get Started — Free/)).toBeInTheDocument();
  });

  it("renders the how-it-works section", () => {
    render(<App />);
    expect(screen.getByText(/Save from anywhere/)).toBeInTheDocument();
    expect(screen.getByText(/Organize when you/)).toBeInTheDocument();
    expect(screen.getByText(/Build something real/)).toBeInTheDocument();
  });

  it("renders error boundary without crashing on normal render", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it("renders protected routes with sign-in redirect for signed-out users", () => {
    render(<App />);
    // The SignedOut mock renders children, so RedirectToSignIn renders
    // Navigate to a protected route
    window.history.pushState({}, "", "/app");
    render(<App />);
    expect(screen.getAllByTestId("redirect-to-sign-in").length).toBeGreaterThan(
      0
    );
  });
});
