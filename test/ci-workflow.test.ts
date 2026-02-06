import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { join } from "path";

interface WorkflowStep {
  name: string;
  "working-directory"?: string;
  [key: string]: unknown;
}

interface WorkflowJob {
  needs?: string | string[];
  steps: WorkflowStep[];
  if?: string;
  environment?: {
    name: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Workflow {
  on: {
    push?: unknown;
    pull_request?: unknown;
    workflow_dispatch?: unknown;
  };
  env: {
    NODE_VERSION: string;
    COVERAGE_THRESHOLD: number;
  };
  jobs: {
    [key: string]: WorkflowJob;
  };
}

describe("CI/CD Workflow", () => {
  const workflowPath = join(__dirname, "../.github/workflows/ci.yml");
  let workflow: Workflow;

  it("should have valid YAML syntax", () => {
    const content = readFileSync(workflowPath, "utf-8");
    expect(() => {
      workflow = parse(content);
    }).not.toThrow();
  });

  it("should trigger on push and pull_request", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    expect(workflow.on).toHaveProperty("push");
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on).toHaveProperty("workflow_dispatch");
  });

  it("should have all required quality gate jobs in correct order", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    const requiredJobs = [
      "lint-and-format",
      "type-check",
      "unit-tests",
      "cdk-synth",
      "integration-tests",
      "contract-tests",
      "security-scan",
    ];

    for (const job of requiredJobs) {
      expect(workflow.jobs).toHaveProperty(job);
    }
  });

  it("should enforce job dependencies for quality gates", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    // Type check depends on lint
    expect(workflow.jobs["type-check"].needs).toContain("lint-and-format");

    // Unit tests depend on type check
    expect(workflow.jobs["unit-tests"].needs).toContain("type-check");

    // CDK synth depends on unit tests
    expect(workflow.jobs["cdk-synth"].needs).toContain("unit-tests");

    // Integration tests depend on CDK synth
    expect(workflow.jobs["integration-tests"].needs).toContain("cdk-synth");

    // Contract tests depend on integration tests
    expect(workflow.jobs["contract-tests"].needs).toContain(
      "integration-tests"
    );
  });

  it("should use Node.js version from .nvmrc", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    expect(workflow.env.NODE_VERSION).toBe("20");
  });

  it("should enforce 80% coverage threshold", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    expect(workflow.env.COVERAGE_THRESHOLD).toBe(80);

    // Check that unit-tests job has coverage threshold check
    const unitTestsJob = workflow.jobs["unit-tests"];
    expect(unitTestsJob.steps).toBeDefined();

    const hasCoverageCheck = unitTestsJob.steps.some(
      (step) => step.name === "Check coverage threshold"
    );
    expect(hasCoverageCheck).toBe(true);
  });

  it("should include security scanning job", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    expect(workflow.jobs).toHaveProperty("security-scan");

    const securityJob = workflow.jobs["security-scan"];
    const stepNames = securityJob.steps.map((s) => s.name);

    expect(stepNames).toContain("Dependency Vulnerability Scan (npm audit)");
    expect(stepNames).toContain("Secrets Detection");
    expect(stepNames).toContain("SAST with ESLint Security Plugin");
    expect(stepNames).toContain("Agent Code Security Notice");
  });

  it("should include deployment jobs with AWS OIDC", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    expect(workflow.jobs).toHaveProperty("deploy-dev");
    expect(workflow.jobs).toHaveProperty("deploy-prod");

    // Check deploy-dev uses AWS credentials action
    const deployDevJob = workflow.jobs["deploy-dev"];
    const hasAwsConfig = deployDevJob.steps.some(
      (step) => step.name === "Configure AWS Credentials (OIDC)"
    );
    expect(hasAwsConfig).toBe(true);
  });

  it("should include E2E test placeholder", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    expect(workflow.jobs).toHaveProperty("e2e-tests");

    const e2eJob = workflow.jobs["e2e-tests"];
    expect(e2eJob.needs).toContain("deploy-dev");
  });

  it("should run lint and format checks", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    const lintJob = workflow.jobs["lint-and-format"];
    const stepNames = lintJob.steps.map((s) => s.name);

    expect(stepNames).toContain("Run format check");
    expect(stepNames).toContain("Run lint");
  });

  it("should run CDK synth in infra directory", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    const cdkJob = workflow.jobs["cdk-synth"];
    const synthStep = cdkJob.steps.find((s) => s.name === "CDK Synth");

    expect(synthStep).toBeDefined();
    expect(synthStep["working-directory"]).toBe("./infra");
  });

  it("should only deploy on main branch push", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    const deployDevJob = workflow.jobs["deploy-dev"];
    expect(deployDevJob.if).toContain("github.ref == 'refs/heads/main'");
    expect(deployDevJob.if).toContain("github.event_name == 'push'");
  });

  it("should have production environment protection", () => {
    const content = readFileSync(workflowPath, "utf-8");
    workflow = parse(content);

    const deployProdJob = workflow.jobs["deploy-prod"];
    expect(deployProdJob.environment).toBeDefined();
    expect(deployProdJob.environment.name).toBe("production");
  });
});
