import { useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

function JwtCopier() {
  const { getToken } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyJwt = async () => {
    const token = await getToken();
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={copyJwt}
      style={{
        padding: "8px 16px",
        background: copied ? "#22c55e" : "#3b82f6",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
      }}
    >
      {copied ? "Copied!" : "Copy JWT"}
    </button>
  );
}

function App() {
  return (
    <div style={{ padding: "32px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 600 }}>AI Learning Hub</h1>
      <SignedOut>
        <p style={{ marginTop: "16px", color: "#666" }}>
          Sign in to get a JWT for smoke testing.
        </p>
        <div style={{ marginTop: "12px" }}>
          <SignInButton />
        </div>
      </SignedOut>
      <SignedIn>
        <div
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <UserButton />
          <JwtCopier />
        </div>
        <p style={{ marginTop: "12px", color: "#666", fontSize: "14px" }}>
          Click "Copy JWT" then use it with the smoke test.
        </p>
      </SignedIn>
    </div>
  );
}

export default App;
