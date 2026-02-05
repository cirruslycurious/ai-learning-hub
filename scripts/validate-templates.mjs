#!/usr/bin/env node
/**
 * Validates GitHub issue and PR templates:
 * - Issue templates: YAML frontmatter (name, labels) and required sections
 *   (Acceptance Criteria, Related Files / File List, Testing Requirements).
 * - PR template: presence of Checklist and Agent / Code Review section.
 *
 * Exit 0 if all pass; 1 if any check fails.
 * Story 1-6 follow-up (L4/#66).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const issueTemplateDir = path.join(root, '.github', 'ISSUE_TEMPLATE');
const prTemplatePath = path.join(root, '.github', 'PULL_REQUEST_TEMPLATE.md');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const yaml = match[1];
  const out = {};
  for (const line of yaml.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function hasAnyRelatedSection(content) {
  return (
    /^##\s+Related Files/m.test(content) ||
    /^##\s+Related Files\s*\/\s*File List/m.test(content) ||
    /^##\s+File List/m.test(content)
  );
}

function validateIssueTemplate(filePath) {
  const name = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];

  const fm = parseFrontmatter(content);
  if (!fm) {
    errors.push(`${name}: missing YAML frontmatter (--- ... ---)`);
  } else {
    if (!fm.name) errors.push(`${name}: frontmatter missing 'name'`);
    if (!fm.labels) errors.push(`${name}: frontmatter missing 'labels'`);
  }

  if (!content.includes('Acceptance Criteria'))
    errors.push(`${name}: missing section "Acceptance Criteria"`);
  if (!hasAnyRelatedSection(content))
    errors.push(`${name}: missing section "Related Files" or "Related Files / File List"`);
  if (!content.includes('Testing Requirements'))
    errors.push(`${name}: missing section "Testing Requirements"`);

  return errors;
}

function validatePrTemplate(filePath) {
  if (!fs.existsSync(filePath)) return [`PR template not found: ${filePath}`];
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  if (!content.includes('## Checklist')) errors.push('PULL_REQUEST_TEMPLATE.md: missing "## Checklist"');
  if (!content.includes('Agent / Code Review'))
    errors.push('PULL_REQUEST_TEMPLATE.md: missing "Agent / Code Review" section');
  return errors;
}

let exitCode = 0;

// Issue templates
const issueFiles = fs.readdirSync(issueTemplateDir).filter((f) => f.endsWith('.md'));
for (const f of issueFiles) {
  const errs = validateIssueTemplate(path.join(issueTemplateDir, f));
  if (errs.length) {
    errs.forEach((e) => {
      process.stderr.write(`${e}\n`);
    });
    exitCode = 1;
  }
}

// PR template
const prErrs = validatePrTemplate(prTemplatePath);
if (prErrs.length) {
  prErrs.forEach((e) => {
    process.stderr.write(`${e}\n`);
  });
  exitCode = 1;
}

if (exitCode === 0) {
  process.stdout.write('validate-templates: all checks passed.\n');
}
process.exit(exitCode);
