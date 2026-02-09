---
# Frontmatter tracks document identity, version progression, and pipeline context
title: "[Document Title Goes Here]"
version: v1 # v1 → v1r1 → v2 → v2r1 → v3 → v3r1 → v3r2 (see versioning below)
author: tech-writer
date: 2026-02-08T00:00:00Z # ISO 8601 timestamp when this version was created
artifact_type: draft
pipeline_step: "Step 3: Draft v1" # Which pipeline step produced this draft
addresses_reviews: [] # Array of review files this draft addresses (empty for v1)
# Example for later versions:
# addresses_reviews:
#   - "05-editorial-review-v1.md"        # Draft v1r1 addresses these
#   - "07-sme-review-v1.md"              # Draft v2 addresses these
#   - "09-editorial-review-v2.md"        # Draft v3 addresses these
#   - "11-sme-review-v2.md"
---

<!--
VERSIONING GUIDE:
- v1: First draft from outline + outline review
- v1r1: Revision of v1 (addresses MUST-CHANGE items from editorial review)
- v2: Second draft (incorporates SME feedback, includes diagram suggestions)
- v2r1: Revision of v2 (if needed)
- v3: Third draft (incorporates editorial + SME feedback from v2 reviews)
- v3r1: First QA revision (addresses QA Reader confusion points)
- v3r2: Second QA revision (if QA still has issues after v3r1)

ADDRESSES_REVIEWS TRACKING:
- v1: []  (no prior reviews)
- v1r1: ["05-editorial-review-v1.md"]
- v2: ["05-editorial-review-v1.md", "07-sme-review-v1.md"]
- v3: ["09-editorial-review-v2.md", "11-sme-review-v2.md"]
- v3r1: ["15-qa-read-v1.md"]
- v3r2: ["17-qa-read-v2.md"]
-->

<!-- ============================================================================
     REVISION NOTES
     Skip this section for v1. Required for v1r1 and all subsequent versions.
     ============================================================================ -->

## Revision Notes

<!-- DELETE THIS SECTION for v1 drafts. For v1r1+, document what changed. -->

**What Changed from Previous Version:**

- Changed [specific section/element] based on [review file] item #[number]
- Added [new content/section] to address [reviewer concern]
- Removed [content] per [review file] MUST-CHANGE item #[number]
- Restructured [section] to improve [clarity/flow/task-orientation]

**Review Items Addressed:**

<!-- Reference specific review items by file and item number -->

- **05-editorial-review-v1.md, Item #1 [MUST]:** Fixed passive voice in Introduction section (lines 45-52)
- **05-editorial-review-v1.md, Item #3 [SHOULD]:** Reordered sections to put "Core Tasks" before "Reference"
- **07-sme-review-v1.md, Item #2 [MUST]:** Corrected API endpoint path (was `/api/users`, now `/api/v1/users`)
- **11-sme-review-v2.md, Item #5 [SHOULD]:** Added prerequisite version check for Node.js 18+

**SHOULD Items Declined:**

<!-- Document any SHOULD items you chose not to implement and explain why -->

- **05-editorial-review-v1.md, Item #7 [SHOULD]:** Declined suggestion to add glossary section. Rationale: Technical terms are defined inline on first use, and the document is short enough that a separate glossary would add overhead without value.
- **09-editorial-review-v2.md, Item #4 [SHOULD]:** Declined suggestion to split "Core Tasks" into multiple H2 sections. Rationale: The three tasks are tightly coupled and share context; splitting would create repetition in prerequisites.

---

<!-- ============================================================================
     MAIN CONTENT
     This is the actual document body. Structure follows task-based principles.
     ============================================================================ -->

# [Document Title]

<!-- Overview: 1-2 paragraphs stating what this document covers, who it's for,
     and what the reader will accomplish. No background or motivation. -->

This guide explains how to [primary task/goal]. You configure [system/feature], verify [expected outcome], and troubleshoot [common issues].

This document is for [target audience] who need to [accomplish specific goal]. You should have [prerequisite knowledge] before starting.

---

## Prerequisites

<!-- MUST appear before the first procedure. List each prerequisite as a bullet.
     Include version numbers where applicable. -->

Before you begin, ensure you have:

- [Software/tool] version [X.Y+] installed ([Installation Guide](./installation.md))
- [Access level/permission] to [system/resource]
- [Configuration file/credential] available at `[path/location]`
- [Prerequisite task] completed (see [Related Guide](./prerequisite.md))

---

## Getting Started

<!-- First task-oriented section. Opener states what the reader accomplishes.
     Section shows initial setup or first critical procedure. -->

You configure [initial setup element] and verify [expected state]. This section covers [scope of setup].

### Set Up [Component/Feature]

<!-- Procedures use numbered lists. Each step begins with a verb. -->

1. Open [tool/interface] and navigate to [location].
2. Create a new [entity] with these settings:
   - **[Property 1]:** `[value]`
   - **[Property 2]:** `[value]`
   - **[Property 3]:** `[value]`
3. Save the configuration to `[file path]`.
4. Run the following command to verify the setup:

   ```bash
   [command] --verify
   ```

   Expected output:

   ```
   [expected output text]
   Status: OK
   ```

### Verify [Critical Functionality]

<!-- Each procedure section has a clear goal stated in the opener. -->

1. Navigate to `[URL or interface location]`.
2. Execute [action] and observe [expected result].
3. Check [log file/output] for confirmation:

   ```
   [expected log entry]
   ```

---

## Core Tasks

<!-- Primary value section. Task-based procedures come before reference material.
     Each subsection is a discrete task the reader will perform. -->

This section covers the primary tasks you perform with [system/feature]. You [task 1], [task 2], and [task 3].

### [Task 1: Action-Oriented Heading]

<!-- Opener: "You [accomplish X]." Then provide steps. -->

You [specific outcome of this task]. This task [context or when to do this].

#### Prerequisites

<!-- Task-specific prerequisites appear immediately before the task steps. -->

- [Prerequisite specific to this task]
- [Another task-specific requirement]

#### Steps

1. [First action step starting with verb].
2. [Second action step with specific details]:

   ```[language]
   [code example]
   ```

3. [Third action step with expected outcome].
4. Verify the result:
   - [Check 1]: Ensure [expected state]
   - [Check 2]: Confirm [expected behavior]

**Expected Result:** [What success looks like after completing these steps]

### [Task 2: Another Action-Oriented Heading]

You [accomplish second task]. This builds on [Task 1] by [relationship].

1. [Action step with connection to previous task].
2. [Action step with configuration example]:

   | Parameter  | Value              | Description                    |
   | ---------- | ------------------ | ------------------------------ |
   | `[param1]` | `[value]`          | [What this parameter controls] |
   | `[param2]` | `[value]`          | [What this parameter controls] |
   | `[param3]` | `[value or range]` | [What this parameter controls] |

3. [Action step with validation].

### [Task 3: Final Core Task Heading]

You [accomplish third task]. After completing this task, you have [end state].

1. [Action step].
2. [Action step with inline decision]:
   - **If [condition]:** [Alternative action]
   - **If [other condition]:** [Different action]
3. [Final verification step].

---

## Reference

<!-- Reference material comes AFTER task-based sections. Non-sequential information
     presented as tables, unordered lists, or definition lists. -->

This section provides reference information for [system/feature]. Use this section to look up [types of reference data].

### Configuration Options

<!-- Reference data in table format. No numbered lists for non-sequential items. -->

| Option            | Type      | Default   | Description                                       |
| ----------------- | --------- | --------- | ------------------------------------------------- |
| `[option_name_1]` | `string`  | `[value]` | [What this option controls and when to change it] |
| `[option_name_2]` | `integer` | `[value]` | [What this option controls and valid range]       |
| `[option_name_3]` | `boolean` | `[value]` | [What this option enables/disables]               |
| `[option_name_4]` | `array`   | `[]`      | [What this option accepts and format]             |

### API Endpoints

<!-- API reference comes after procedural content. -->

**Base URL:** `https://[api-domain]/api/v1`

#### `GET /[resource]`

Retrieves [what this endpoint returns].

**Query Parameters:**

- `[param1]` (optional): [Description and valid values]
- `[param2]` (required): [Description and constraints]

**Response:**

```json
{
  "[field1]": "[value or type]",
  "[field2]": "[value or type]",
  "[field3]": {
    "[nested_field]": "[value or type]"
  }
}
```

#### `POST /[resource]`

Creates [what this endpoint creates].

**Request Body:**

```json
{
  "[required_field]": "[value or type]",
  "[optional_field]": "[value or type]"
}
```

**Response:** Returns `201 Created` with the created resource.

### Command Reference

<!-- Commands listed with syntax and examples. -->

#### `[command-name]`

**Syntax:**

```bash
[command] [required-arg] [--optional-flag]
```

**Options:**

- `--[flag-name]`: [What this flag does]
- `--[another-flag] [value]`: [What this flag does and acceptable values]

**Example:**

```bash
[command] [example-argument] --[flag] [value]
```

---

## Troubleshooting

<!-- Common issues and fixes. Each issue is a subsection with problem statement
     and solution steps. -->

This section covers common issues and their solutions.

### [Issue 1: Descriptive Problem Statement]

**Symptom:** [What the user observes when this issue occurs]

**Cause:** [Why this issue happens]

**Solution:**

1. [First action to resolve the issue].
2. [Second action or verification step].
3. [Confirmation that the issue is resolved].

### [Issue 2: Another Problem Statement]

**Symptom:** [Observable behavior or error message]

**Cause:** [Root cause explanation]

**Solution:**

1. Check [specific file/setting] for [expected value]:

   ```bash
   [command to check setting]
   ```

2. If the value is incorrect, update it to:

   ```
   [correct value or configuration]
   ```

3. Restart [service/application] and verify:

   ```bash
   [verification command]
   ```

### [Issue 3: Third Common Issue]

**Symptom:** [What happens]

**Cause:** [Why it happens]

**Solution:**

- **If [condition]:** [Specific fix for this condition]
- **If [other condition]:** [Different fix for this condition]
- **If neither applies:** [Escalation path or where to get help]

---

<!-- ============================================================================
     DIAGRAM PLACEHOLDERS
     Skip this section for Draft v1. Add for Draft v2+ with diagram suggestions.
     ============================================================================ -->

## Diagram Placeholders

<!-- DELETE THIS SECTION for Draft v1. Add in Draft v2+ to show where diagrams
     should be inserted. Each placeholder references a diagram from the Designer. -->

### Diagram 1: [Diagram Title/Purpose]

**Location in Document:** Insert after [section name], before [next section name]

**Diagram Purpose:** Show [what this diagram illustrates]

**Suggested Content:**

- [Element 1 to show in diagram]
- [Element 2 to show in diagram]
- [Relationship or flow to illustrate]

**Reference:** See `10-diagrams-v1.md` or `14-diagrams-v2.md` for mermaid source

---

### Diagram 2: [Another Diagram Title]

**Location in Document:** Insert in [section name], after step [number]

**Diagram Purpose:** Illustrate [what this diagram shows]

**Suggested Content:**

- [Component or concept to visualize]
- [Another component or step]
- [Connection or data flow]

**Reference:** See `10-diagrams-v1.md` or `14-diagrams-v2.md` for mermaid source

---

<!-- ============================================================================
     OPEN ITEMS
     Track unresolved questions, known gaps, or pending decisions.
     ============================================================================ -->

## Open Items

<!-- List unresolved questions or known gaps that need addressing in future
     revisions. Remove items as they're resolved. Delete section when empty. -->

- **[Open Item 1]:** Need to verify [specific detail] with SME. Placeholder value used in [section name].
- **[Open Item 2]:** Missing information about [topic]. Will add in next revision after [source] is available.
- **[Open Item 3]:** Decision pending on whether to include [optional content]. Will confirm with stakeholder.
- **[Open Item 4]:** [Specific technical detail] needs validation. Current draft shows [assumption].

---

<!-- ============================================================================
     END OF TEMPLATE

     USAGE NOTES:

     1. For v1 drafts:
        - Delete "Revision Notes" section entirely
        - Delete "Diagram Placeholders" section
        - Set addresses_reviews: []
        - Set pipeline_step: "Step 3: Draft v1"

     2. For v1r1 drafts (editorial revision):
        - Include "Revision Notes" section
        - Set addresses_reviews: ["05-editorial-review-v1.md"]
        - Set pipeline_step: "Step 4b: Draft v1r1"

     3. For v2 drafts:
        - Include "Revision Notes" section
        - Include "Diagram Placeholders" section
        - Set addresses_reviews: ["05-editorial-review-v1.md", "07-sme-review-v1.md"]
        - Set pipeline_step: "Step 6: Draft v2"

     4. For v3 drafts:
        - Include "Revision Notes" section
        - Include "Diagram Placeholders" section (updated from v2)
        - Set addresses_reviews: ["09-editorial-review-v2.md", "11-sme-review-v2.md"]
        - Set pipeline_step: "Step 9: Draft v3"

     5. For v3r1 and v3r2 (QA revisions):
        - Include "Revision Notes" section
        - addresses_reviews: ["15-qa-read-v1.md"] for v3r1
        - addresses_reviews: ["17-qa-read-v2.md"] for v3r2
        - Set pipeline_step: "Step 11b: Draft v3r1" or "Step 11d: Draft v3r2"

     ============================================================================ -->
