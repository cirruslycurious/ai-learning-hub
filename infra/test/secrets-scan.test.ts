import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";

/**
 * Comprehensive secrets scan for ALL infra TypeScript files.
 * Covers patterns from the security audit report (Part 3).
 * This is additive — existing app-structure.test.ts tests remain untouched.
 */

// __dirname is infra/test/ — go up one level to infra/
const infraRoot = join(__dirname, "..");
const files = globSync("**/*.ts", {
  cwd: infraRoot,
  ignore: [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/vitest.config.ts",
  ],
});

describe("Secrets scan — all infra files", () => {
  // Ensure we're actually scanning files
  it("should find infra source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    describe(file, () => {
      const content = readFileSync(join(infraRoot, file), "utf-8");

      // --- AWS Account IDs ---
      it("should not contain AWS account IDs in string literals", () => {
        // Match 12-digit numbers inside quotes (string literals)
        expect(content).not.toMatch(/['"`]\d{12}['"`]/);
      });

      // --- AWS Access Keys ---
      it("should not contain AWS access keys (AKIA pattern)", () => {
        expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/);
      });

      // --- AWS Resource IDs ---
      it("should not contain VPC IDs", () => {
        expect(content).not.toMatch(/\bvpc-[0-9a-f]{8,17}\b/);
      });

      it("should not contain Subnet IDs", () => {
        expect(content).not.toMatch(/\bsubnet-[0-9a-f]{8,17}\b/);
      });

      it("should not contain Security Group IDs", () => {
        expect(content).not.toMatch(/\bsg-[0-9a-f]{8,17}\b/);
      });

      it("should not contain NAT Gateway IDs", () => {
        expect(content).not.toMatch(/\bnat-[0-9a-f]{8,17}\b/);
      });

      it("should not contain Internet Gateway IDs", () => {
        expect(content).not.toMatch(/\bigw-[0-9a-f]{8,17}\b/);
      });

      it("should not contain Route Table IDs", () => {
        expect(content).not.toMatch(/\brtb-[0-9a-f]{8,17}\b/);
      });

      it("should not contain ENI IDs", () => {
        expect(content).not.toMatch(/\beni-[0-9a-f]{8,17}\b/);
      });

      it("should not contain AMI IDs", () => {
        expect(content).not.toMatch(/\bami-[0-9a-f]{8,17}\b/);
      });

      it("should not contain Snapshot IDs", () => {
        expect(content).not.toMatch(/\bsnap-[0-9a-f]{8,17}\b/);
      });

      it("should not contain EIP Allocation IDs", () => {
        expect(content).not.toMatch(/\beipalloc-[0-9a-f]{8,17}\b/);
      });

      // --- Private Key Material ---
      it("should not contain private key material", () => {
        expect(content).not.toMatch(
          /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/
        );
      });

      // --- Third-Party API Keys ---
      it("should not contain Clerk secret keys", () => {
        expect(content).not.toMatch(/\bsk_(live|test)_[A-Za-z0-9]+/);
      });

      it("should not contain Clerk publishable keys", () => {
        expect(content).not.toMatch(/\bpk_(live|test)_[A-Za-z0-9]+/);
      });

      it("should not contain Stripe keys", () => {
        expect(content).not.toMatch(/\bsk_live_[A-Za-z0-9]+/);
        expect(content).not.toMatch(/\brk_live_[A-Za-z0-9]+/);
      });

      it("should not contain SendGrid keys", () => {
        expect(content).not.toMatch(/\bSG\.[A-Za-z0-9_-]+/);
      });

      it("should not contain Twilio API keys", () => {
        expect(content).not.toMatch(/\bSK[0-9a-f]{32}\b/);
      });

      it("should not contain GitHub PATs", () => {
        expect(content).not.toMatch(/\bghp_[A-Za-z0-9]{36}\b/);
        expect(content).not.toMatch(/\bgithub_pat_[A-Za-z0-9_]+/);
      });

      it("should not contain JWT tokens", () => {
        expect(content).not.toMatch(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+/);
      });

      // --- Connection Strings ---
      it("should not contain connection strings", () => {
        expect(content).not.toMatch(/mongodb(\+srv)?:\/\/[^\s]+/);
        expect(content).not.toMatch(/postgres(ql)?:\/\/[^\s]+/);
        expect(content).not.toMatch(/redis:\/\/[^\s]+/);
        expect(content).not.toMatch(/mysql:\/\/[^\s]+/);
      });

      // --- AWS-Specific Patterns ---
      it("should not contain AWS session token references", () => {
        expect(content).not.toMatch(/aws_session_token/i);
      });

      it("should not contain ARNs with embedded account IDs", () => {
        expect(content).not.toMatch(/arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:/);
      });
    });
  }
});

// --- M4: Scan cdk.json for secrets ---
describe("Secrets scan — cdk.json", () => {
  // cdk.json lives at infra/cdk.json — __dirname is infra/test/
  const cdkJsonPath = join(__dirname, "..", "cdk.json");
  let cdkContent: string;

  try {
    cdkContent = readFileSync(cdkJsonPath, "utf-8");
  } catch {
    cdkContent = "";
  }

  it("cdk.json should exist", () => {
    expect(cdkContent.length).toBeGreaterThan(0);
  });

  it("should not contain AWS account IDs", () => {
    expect(cdkContent).not.toMatch(/\b\d{12}\b/);
  });

  it("should not contain AWS resource IDs", () => {
    expect(cdkContent).not.toMatch(
      /\b(vpc|subnet|sg|nat|igw|rtb|eni|ami|snap)-[0-9a-f]{8,17}\b/
    );
  });

  it("should not contain ARNs with account IDs", () => {
    expect(cdkContent).not.toMatch(/arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:/);
  });
});
