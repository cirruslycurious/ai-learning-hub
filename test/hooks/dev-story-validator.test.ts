import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  extractStep,
  checkNoDuplicateStoryParse,
  checkNoDoubleRead,
  checkNoGhostProjectContext,
  checkSprintStatusReadOnce,
  checkSingleDoDSource,
  checkNoDuplicateVariable,
  checkBraceConsistency,
  parseArgs,
  runAllChecks,
} = require("../../.claude/hooks/dev-story-validator.cjs");

// ─── Synthetic helpers ──────────────────────────────────────────────────────

function makeStep(n: number, content: string): string {
  return `<step n="${n}" goal="test step ${n}">\n${content}\n</step>`;
}

function makeWorkflow(...steps: string[]): string {
  return `<workflow>\n${steps.join("\n")}\n</workflow>`;
}

function makeYaml(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

// ─── extractStep ────────────────────────────────────────────────────────────

describe("extractStep", () => {
  it("extracts step content by number", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Do thing one</action>"),
      makeStep(2, "<action>Do thing two</action>")
    );
    expect(extractStep(xml, 1)).toContain("Do thing one");
    expect(extractStep(xml, 2)).toContain("Do thing two");
  });

  it("returns null for missing step", () => {
    const xml = makeWorkflow(makeStep(1, "<action>Only step</action>"));
    expect(extractStep(xml, 5)).toBeNull();
  });
});

// ─── 3.1: checkNoDuplicateStoryParse ────────────────────────────────────────

describe("checkNoDuplicateStoryParse", () => {
  it("FAIL when Step 2 contains 'Parse sections:' action", () => {
    const xml = makeWorkflow(
      makeStep(
        1,
        "<action>Parse sections: Story, Acceptance Criteria</action>"
      ),
      makeStep(2, "<action>Parse sections: Story, Acceptance Criteria</action>")
    );
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("Parse sections:");
  });

  it("FAIL when Step 2 contains 'Load comprehensive context from story file'", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Something</action>"),
      makeStep(
        2,
        "<action>Load comprehensive context from story file's Dev Notes section</action>"
      )
    );
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain(
      "Load comprehensive context from story file"
    );
  });

  it("FAIL when Step 2 contains 'Extract developer guidance from Dev Notes'", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Something</action>"),
      makeStep(
        2,
        "<action>Extract developer guidance from Dev Notes: architecture requirements</action>"
      )
    );
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain(
      "Extract developer guidance from Dev Notes"
    );
  });

  it("PASS when Step 2 has only output and no parse actions", () => {
    const xml = makeWorkflow(
      makeStep(
        1,
        "<action>Parse sections: Story, Acceptance Criteria</action>"
      ),
      makeStep(2, "<output>Context Loaded</output>")
    );
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS: Step 1 parse actions do not false-positive", () => {
    const xml = makeWorkflow(
      makeStep(
        1,
        "<action>Parse sections: Story, Acceptance Criteria</action>\n" +
          "<action>Load comprehensive context from story file's Dev Notes section</action>"
      ),
      makeStep(2, "<output>Context Loaded</output>")
    );
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(true);
  });

  it("EDGE: Step 2 with comment mentioning parse (not in action) passes", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Something</action>"),
      makeStep(
        2,
        "<!-- parse is mentioned here but not in action -->\n<output>Done</output>"
      )
    );
    const result = checkNoDuplicateStoryParse(xml);
    expect(result.pass).toBe(true);
  });
});

// ─── 3.2: checkNoDoubleRead ────────────────────────────────────────────────

describe("checkNoDoubleRead", () => {
  it("FAIL when Read COMPLETE story file appears after task_check anchor", () => {
    const xml = makeWorkflow(
      makeStep(
        1,
        "<action>Read COMPLETE story file</action>\n" +
          '<anchor id="task_check" />\n' +
          "<action>Read COMPLETE story file from discovered path</action>"
      )
    );
    const result = checkNoDoubleRead(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("double read");
  });

  it("PASS when no read action after anchor", () => {
    const xml = makeWorkflow(
      makeStep(
        1,
        "<action>Read COMPLETE story file</action>\n" +
          '<anchor id="task_check" />\n' +
          "<action>Identify first incomplete task</action>"
      )
    );
    const result = checkNoDoubleRead(xml);
    expect(result.pass).toBe(true);
  });

  it("PASS when read action is in Step 1 before anchor", () => {
    const xml = makeWorkflow(
      makeStep(
        1,
        "<action>Read COMPLETE story file</action>\n" +
          "<action>Do other stuff</action>\n" +
          '<anchor id="task_check" />\n' +
          "<action>Process tasks</action>"
      )
    );
    const result = checkNoDoubleRead(xml);
    expect(result.pass).toBe(true);
  });

  it("EDGE: anchor missing entirely — informational finding", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Read COMPLETE story file</action>")
    );
    const result = checkNoDoubleRead(xml);
    expect(result.pass).toBe(true);
    expect(result.findings[0]).toContain("No task_check anchor");
  });
});

// ─── 3.3: checkNoGhostProjectContext ────────────────────────────────────────

describe("checkNoGhostProjectContext", () => {
  it("FAIL when YAML has project_context key", () => {
    const yaml = makeYaml({
      name: "dev-story",
      project_context: '"**/project-context.md"',
    });
    const xml = makeWorkflow(makeStep(2, "<output>Done</output>"));
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("project_context");
  });

  it("FAIL when XML Step 2 references {project_context}", () => {
    const yaml = makeYaml({ name: "dev-story" });
    const xml = makeWorkflow(
      makeStep(
        2,
        "<action>Load {project_context} for coding standards</action>"
      )
    );
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("{project_context}");
  });

  it("FAIL when both present — reports 2 findings", () => {
    const yaml = makeYaml({
      name: "dev-story",
      project_context: '"**/project-context.md"',
    });
    const xml = makeWorkflow(
      makeStep(
        2,
        "<action>Load {project_context} for coding standards</action>"
      )
    );
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(result.pass).toBe(false);
    expect(result.findings).toHaveLength(2);
  });

  it("PASS when both are removed", () => {
    const yaml = makeYaml({ name: "dev-story" });
    const xml = makeWorkflow(makeStep(2, "<output>Context Loaded</output>"));
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("PASS: XML prose mentioning 'project context' without braces is fine", () => {
    const yaml = makeYaml({ name: "dev-story" });
    const xml = makeWorkflow(
      makeStep(
        2,
        "<output>Project context is already loaded via CLAUDE.md</output>"
      )
    );
    const result = checkNoGhostProjectContext(yaml, xml);
    expect(result.pass).toBe(true);
  });
});

// ─── 3.4: checkSprintStatusReadOnce ─────────────────────────────────────────

describe("checkSprintStatusReadOnce", () => {
  it("FAIL when Step 4 loads the full sprint-status file", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Load the FULL file: {{sprint_status}}</action>"),
      makeStep(4, "<action>Load the FULL file: {{sprint_status}}</action>")
    );
    const result = checkSprintStatusReadOnce(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("Step 4");
  });

  it("FAIL when Step 9 loads the full sprint-status file", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Load the FULL file: {{sprint_status}}</action>"),
      makeStep(9, "<action>Load the FULL file: {sprint_status}</action>")
    );
    const result = checkSprintStatusReadOnce(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("Step 9");
  });

  it("PASS when Steps 4 and 9 reference cached content", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Load the FULL file: {{sprint_status}}</action>"),
      makeStep(
        4,
        "<action>Use the sprint-status.yaml content loaded in Step 1</action>"
      ),
      makeStep(
        9,
        "<action>Use the sprint-status.yaml content retained from Step 1</action>"
      )
    );
    const result = checkSprintStatusReadOnce(xml);
    expect(result.pass).toBe(true);
  });

  it("PASS: Step 1 loading full file does not trigger", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Load the FULL file: {{sprint_status}}</action>")
    );
    const result = checkSprintStatusReadOnce(xml);
    expect(result.pass).toBe(true);
  });

  it("EDGE: Step 4 writing to sprint_status passes (writes are fine)", () => {
    const xml = makeWorkflow(
      makeStep(
        4,
        "<action>Update development_status[{{story_key}}] in sprint_status</action>"
      )
    );
    const result = checkSprintStatusReadOnce(xml);
    expect(result.pass).toBe(true);
  });
});

// ─── 3.5: checkSingleDoDSource ──────────────────────────────────────────────

describe("checkSingleDoDSource", () => {
  it("FAIL when Step 9 has inline DoD validation list", () => {
    const xml = makeWorkflow(
      makeStep(
        9,
        "<action>Validate definition-of-done checklist with essential requirements:\n" +
          "  - All tasks/subtasks marked complete\n" +
          "  - Implementation satisfies every AC\n" +
          "</action>"
      )
    );
    const result = checkSingleDoDSource(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("inline DoD");
  });

  it("FAIL when Step 10 re-executes DoD checklist", () => {
    const xml = makeWorkflow(
      makeStep(
        9,
        "<action>Execute definition-of-done validation using the {validation} checklist</action>"
      ),
      makeStep(
        10,
        "<action>Execute the enhanced definition-of-done checklist using the validation framework</action>"
      )
    );
    const result = checkSingleDoDSource(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("Step 10");
  });

  it("PASS when Step 9 references {validation} only", () => {
    const xml = makeWorkflow(
      makeStep(
        9,
        "<action>Execute definition-of-done validation using the {validation} checklist</action>"
      ),
      makeStep(
        10,
        "<action>Prepare a concise summary in Dev Agent Record</action>"
      )
    );
    const result = checkSingleDoDSource(xml);
    expect(result.pass).toBe(true);
  });

  it("PASS when Step 10 has summary/communication only", () => {
    const xml = makeWorkflow(
      makeStep(
        9,
        "<action>Execute definition-of-done validation using the {validation} checklist</action>"
      ),
      makeStep(
        10,
        "<action>Communicate to user that story is complete</action>"
      )
    );
    const result = checkSingleDoDSource(xml);
    expect(result.pass).toBe(true);
  });
});

// ─── 3.6: checkNoDuplicateVariable ──────────────────────────────────────────

describe("checkNoDuplicateVariable", () => {
  it("FAIL when YAML has both story_dir and implementation_artifacts", () => {
    const yaml = makeYaml({
      story_dir: '"{config_source}:implementation_artifacts"',
      implementation_artifacts: '"{config_source}:implementation_artifacts"',
    });
    const result = checkNoDuplicateVariable(yaml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("story_dir");
  });

  it("PASS when YAML has only implementation_artifacts", () => {
    const yaml = makeYaml({
      implementation_artifacts: '"{config_source}:implementation_artifacts"',
    });
    const result = checkNoDuplicateVariable(yaml);
    expect(result.pass).toBe(true);
  });

  it("PASS when YAML has only story_dir (unusual but not a duplicate)", () => {
    const yaml = makeYaml({
      story_dir: '"{config_source}:implementation_artifacts"',
    });
    const result = checkNoDuplicateVariable(yaml);
    expect(result.pass).toBe(true);
  });

  it("EDGE: YAML comment mentioning story_dir passes", () => {
    const yaml =
      "# story_dir was removed in favor of implementation_artifacts\n" +
      'implementation_artifacts: "{config_source}:implementation_artifacts"';
    const result = checkNoDuplicateVariable(yaml);
    expect(result.pass).toBe(true);
  });
});

// ─── 3.7: checkBraceConsistency ─────────────────────────────────────────────

describe("checkBraceConsistency", () => {
  it("FAIL when XML has single-brace {sprint_status}", () => {
    const xml = makeWorkflow(
      makeStep(
        9,
        '<check if="{sprint_status} file exists">\n<action>Do something</action>\n</check>'
      )
    );
    const result = checkBraceConsistency(xml);
    expect(result.pass).toBe(false);
    expect(result.findings[0]).toContain("single-brace");
  });

  it("PASS when XML uses only double-brace {{sprint_status}}", () => {
    const xml = makeWorkflow(
      makeStep(
        4,
        '<check if="{{sprint_status}} file exists">\n<action>Do</action>\n</check>'
      ),
      makeStep(
        9,
        '<check if="{{sprint_status}} file exists">\n<action>Do</action>\n</check>'
      )
    );
    const result = checkBraceConsistency(xml);
    expect(result.pass).toBe(true);
  });

  it("PASS when XML has no sprint_status references at all", () => {
    const xml = makeWorkflow(
      makeStep(1, "<action>Do something unrelated</action>")
    );
    const result = checkBraceConsistency(xml);
    expect(result.pass).toBe(true);
  });

  it("EDGE: single-brace in prose is still flagged for safety", () => {
    const xml = makeWorkflow(
      makeStep(9, "<!-- The {sprint_status} file is loaded in Step 1 -->")
    );
    const result = checkBraceConsistency(xml);
    expect(result.pass).toBe(false);
  });
});

// ─── runAllChecks ───────────────────────────────────────────────────────────

describe("runAllChecks", () => {
  it("all pass returns pass: true with empty findings", () => {
    const yaml = makeYaml({ name: "dev-story" });
    const xml = makeWorkflow(
      makeStep(
        1,
        '<action>Load the FULL file: {{sprint_status}}</action>\n<anchor id="task_check" />\n<action>Process</action>'
      ),
      makeStep(2, "<output>Context Loaded</output>"),
      makeStep(4, "<action>Use cached sprint-status</action>"),
      makeStep(
        9,
        "<action>Execute definition-of-done validation using the {validation} checklist</action>"
      ),
      makeStep(10, "<action>Communicate completion</action>")
    );
    const result = runAllChecks({ xml, yaml });
    expect(result.pass).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it("some fail returns pass: false with aggregated findings", () => {
    const yaml = makeYaml({
      name: "dev-story",
      project_context: '"**/project-context.md"',
      story_dir: '"{config_source}:implementation_artifacts"',
      implementation_artifacts: '"{config_source}:implementation_artifacts"',
    });
    const xml = makeWorkflow(
      makeStep(1, '<anchor id="task_check" />\n<action>Process</action>'),
      makeStep(2, "<output>Done</output>")
    );
    const result = runAllChecks({ xml, yaml });
    expect(result.pass).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("returns results object keyed by check name", () => {
    const yaml = makeYaml({ name: "dev-story" });
    const xml = makeWorkflow(
      makeStep(1, '<anchor id="task_check" />'),
      makeStep(2, "<output>Done</output>")
    );
    const result = runAllChecks({ xml, yaml });
    expect(result.results).toHaveProperty("noDuplicateStoryParse");
    expect(result.results).toHaveProperty("noDoubleRead");
    expect(result.results).toHaveProperty("noGhostProjectContext");
    expect(result.results).toHaveProperty("sprintStatusReadOnce");
    expect(result.results).toHaveProperty("singleDoDSource");
    expect(result.results).toHaveProperty("noDuplicateVariable");
    expect(result.results).toHaveProperty("braceConsistency");
  });
});

// ─── parseArgs ──────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("returns defaults when no args provided", () => {
    const result = parseArgs([]);
    expect(result.instructions).toContain("instructions.xml");
    expect(result.workflow).toContain("workflow.yaml");
  });

  it("overrides instructions path", () => {
    const result = parseArgs(["--instructions", "/custom/path.xml"]);
    expect(result.instructions).toBe("/custom/path.xml");
  });

  it("overrides workflow path", () => {
    const result = parseArgs(["--workflow", "/custom/workflow.yaml"]);
    expect(result.workflow).toBe("/custom/workflow.yaml");
  });
});
