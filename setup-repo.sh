#!/bin/bash

# AI Learning Hub - Repository Setup Script
# Run this in an empty directory where you want to create your project

set -e

echo "🚀 Setting up AI Learning Hub repository structure..."

# Create directory structure
mkdir -p docs/epics
mkdir -p infra
mkdir -p frontend
mkdir -p backend
mkdir -p .github/ISSUE_TEMPLATE

# =============================================================================
# CLAUDE.md - Context file for AI assistants
# =============================================================================
cat > CLAUDE.md << 'EOF'
# AI Learning Hub - Claude Context

## What This Project Is

A personal knowledge management and project tracking system for AI/GenAI learning. Three core capabilities:

1. **Resource Library** - Track podcasts, blogs, YouTube channels, Substacks, subreddits, LinkedIn people to learn from
2. **Tutorial Tracker** - Save and track tutorials/walkthroughs for building AI projects
3. **Project Tracker** - Track personal projects with status, tech used, learnings, and notes

## Current Phase

**Phase: Foundation (Epic 0)**
- [ ] Finalizing PRD
- [ ] Defining personas and problems
- [ ] Writing user stories
- [ ] Not yet coding

## Key Documents to Read

Start here, in this order:
1. `docs/PRD.md` - Product requirements (the "what" and "why")
2. `docs/epics/000-project-foundation.md` - Current epic we're working on
3. `docs/ARCHITECTURE.md` - Technical decisions and constraints

## Tech Stack

- **Frontend**: React + Vite
- **Auth**: Clerk or Auth0
- **Backend**: AWS Lambda (Node.js/TypeScript)
- **Database**: DynamoDB
- **Infrastructure**: AWS CDK (TypeScript)
- **Hosting**: S3 + CloudFront
- **Observability**: CloudWatch, X-Ray (TBD)

## Architecture Principles

- Serverless-first (Lambda, DynamoDB, S3, CloudFront)
- Infrastructure as Code (CDK, no ClickOps)
- Mobile-first responsive design
- Observability built-in from day 1 (not bolted on later)
- Strong test coverage before shipping

## How to Work on This Project

1. All work is tracked via GitHub Issues
2. Every change ties back to an issue
3. PRs reference the issue they close
4. Documentation lives in `docs/`, not in chat histories
5. When starting a new AI conversation, point to this file first

## Repository Structure

```
/docs
  PRD.md                    # Product requirements document
  ARCHITECTURE.md           # System design and technical decisions
  /epics                    # Epic specifications
/infra                      # AWS CDK infrastructure code
/frontend                   # React + Vite application
/backend                    # Lambda function handlers
/.github                    # Issue templates, PR templates, workflows
```

## Current Status

🟡 **Pre-development** - Building out specs and PRD before writing code.

---
*Last updated: $(date +%Y-%m-%d)*
EOF

# =============================================================================
# README.md
# =============================================================================
cat > README.md << 'EOF'
# AI Learning Hub

A personal system for tracking AI/GenAI learning resources, tutorials, and projects.

## Why This Exists

I keep finding great resources, tutorials, and project ideas — then losing them in browser tabs, chat histories, and forgotten bookmarks. This is a place to capture, organize, and track everything related to my AI learning journey.

## Features (Planned)

- **Resource Library**: Podcasts, blogs, YouTube channels, Substacks, subreddits, people to follow
- **Tutorial Tracker**: Tutorials and walkthroughs to learn from, with progress tracking
- **Project Tracker**: My own projects — what I'm building, status, tech used, learnings

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Auth | Clerk/Auth0 |
| Backend | AWS Lambda |
| Database | DynamoDB |
| Infra | AWS CDK |
| Hosting | S3 + CloudFront |

## Documentation

- [Product Requirements](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Current Epic](docs/epics/000-project-foundation.md)

## Development

*Coming soon — we're still in the spec phase.*

## License

Private project. Not open source (yet?).
EOF

# =============================================================================
# docs/PRD.md
# =============================================================================
cat > docs/PRD.md << 'EOF'
# AI Learning Hub - Product Requirements Document

> **Status**: Draft
> **Last Updated**: $(date +%Y-%m-%d)
> **Owner**: Stephen

---

## 1. Problem Statement

*TODO: Define the core problems this solves. Not features — problems.*

### Primary Problems
1.
2.
3.

### Why Existing Solutions Fail
- **Browser bookmarks**:
- **Notion/notes apps**:
- **Memory**:

---

## 2. Persona

### Stephen (Primary User)

**Context:**
- *TODO: Who are you in relation to AI learning? Background, experience level, goals.*

**Behaviors:**
- *TODO: How do you currently discover resources? When/where?*

**Frustrations:**
- *TODO: What specifically breaks down? When do you lose things?*

**Goals:**
- *TODO: What does success look like? What do you want to be able to do?*

---

## 3. Jobs to Be Done

*Format: When [situation], I want to [motivation], so I can [outcome].*

### Resource Discovery & Capture
1. When I find an interesting AI resource, I want to capture it in < 10 seconds, so I don't lose it and can engage with it later.
2. *TODO*

### Learning & Progress
1. *TODO*

### Building & Tracking
1. *TODO*

---

## 4. Core Features

*Each feature must map back to a Job to Be Done.*

### 4.1 Resource Library
- *TODO*

### 4.2 Tutorial Tracker
- *TODO*

### 4.3 Project Tracker
- *TODO*

---

## 5. User Stories

*See individual epic documents in `docs/epics/` for detailed user stories.*

---

## 6. Success Metrics

How do we know this is working?

| Metric | Target | How to Measure |
|--------|--------|----------------|
| *TODO* | | |

---

## 7. Technical Constraints

- **Must** be serverless (Lambda, DynamoDB, S3, CloudFront)
- **Must** use CDK for all infrastructure
- **Must** have observability from day 1 (logging, monitoring, tracing)
- **Must** be mobile-first responsive
- **Must** have strong test coverage
- **Should** support offline/quick capture somehow

---

## 8. Out of Scope (V1)

Things we're explicitly NOT building in the first version:

- *TODO*

---

## 9. Open Questions

- *TODO*

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| $(date +%Y-%m-%d) | Stephen | Initial draft |
EOF

# =============================================================================
# docs/ARCHITECTURE.md
# =============================================================================
cat > docs/ARCHITECTURE.md << 'EOF'
# Architecture

> **Status**: Placeholder
> **Last Updated**: $(date +%Y-%m-%d)

This document will contain:

- System architecture diagram
- AWS service choices and rationale
- Data model / DynamoDB table design
- API design
- Auth flow
- Observability strategy
- CDK stack organization

*To be written after PRD is finalized.*
EOF

# =============================================================================
# docs/epics/000-project-foundation.md
# =============================================================================
cat > docs/epics/000-project-foundation.md << 'EOF'
# Epic 0: Project Foundation

> **Status**: In Progress
> **Goal**: Establish project foundation — repo, specs, PRD — before writing any code.

## Why This Epic

We're doing spec-driven development. This epic ensures we have a solid PRD, clear user stories, and testable acceptance criteria before any implementation begins.

## Issues in This Epic

Create these as GitHub Issues:

### Setup
- [ ] **Issue #1**: Create repo structure and CLAUDE.md ✅ *(you're doing this now)*
- [ ] **Issue #2**: Set up GitHub project board for tracking

### Persona & Problems
- [ ] **Issue #3**: Draft persona document (interview myself)
- [ ] **Issue #4**: Document problem statements with specific failure modes
- [ ] **Issue #5**: Define jobs to be done

### User Stories
- [ ] **Issue #6**: Write user stories — Resource Library
- [ ] **Issue #7**: Write user stories — Tutorial Tracker
- [ ] **Issue #8**: Write user stories — Project Tracker
- [ ] **Issue #9**: Write user stories — Quick Capture (cross-cutting)

### Finalization
- [ ] **Issue #10**: Define MVP scope and cut line
- [ ] **Issue #11**: Define success metrics
- [ ] **Issue #12**: Write technical constraints and architecture doc
- [ ] **Issue #13**: Final PRD review and sign-off

## Acceptance Criteria for This Epic

- [ ] PRD is complete with no TODOs
- [ ] Every feature traces back to a job-to-be-done
- [ ] Every job-to-be-done traces back to a real problem
- [ ] User stories have testable acceptance criteria
- [ ] MVP scope is clearly defined
- [ ] Architecture doc outlines key technical decisions

## Exit Criteria

This epic is DONE when:
1. PRD is reviewed and "signed off" (committed with no open questions)
2. Epic 1 (Project Setup / Infrastructure) is ready to begin
EOF

# =============================================================================
# .github/ISSUE_TEMPLATE/epic.md
# =============================================================================
cat > .github/ISSUE_TEMPLATE/epic.md << 'EOF'
---
name: Epic
about: A large body of work broken into smaller issues
title: 'Epic: '
labels: epic
assignees: ''
---

## Summary

*One paragraph describing what this epic accomplishes.*

## Background / Why

*Why are we doing this? What problem does it solve? Link to PRD section if relevant.*

## Scope

### In Scope
-

### Out of Scope
-

## Issues in This Epic

*List of issues that make up this epic. Create these as separate issues and link them here.*

- [ ] #issue-number - Description
- [ ] #issue-number - Description

## Acceptance Criteria

*How do we know this epic is done?*

- [ ]
- [ ]

## Dependencies

*Other epics or external dependencies.*

## Open Questions

-
EOF

# =============================================================================
# .github/ISSUE_TEMPLATE/feature.md
# =============================================================================
cat > .github/ISSUE_TEMPLATE/feature.md << 'EOF'
---
name: Feature
about: A new feature or enhancement
title: ''
labels: feature
assignees: ''
---

## Summary

*One sentence: what does this feature do?*

## User Story

**As a** [user type]
**I want** [goal]
**So that** [benefit]

## Context

*Why is this needed? Link to epic or PRD section.*

Epic: #epic-number

## Acceptance Criteria

*Testable criteria. Use checkboxes.*

- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]

## Technical Notes

*Implementation hints, constraints, or considerations. Optional.*

## Design

*Link to mockups or describe UI if applicable. Optional.*

## Out of Scope

*Explicitly what this issue does NOT cover.*
EOF

# =============================================================================
# .github/ISSUE_TEMPLATE/bug.md
# =============================================================================
cat > .github/ISSUE_TEMPLATE/bug.md << 'EOF'
---
name: Bug
about: Something isn't working correctly
title: 'Bug: '
labels: bug
assignees: ''
---

## Summary

*One sentence: what's broken?*

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

*What should happen?*

## Actual Behavior

*What actually happens?*

## Environment

- Browser/Device:
- OS:
- Relevant versions:

## Screenshots / Logs

*If applicable.*

## Possible Cause

*If you have a hypothesis. Optional.*
EOF

# =============================================================================
# .github/ISSUE_TEMPLATE/task.md
# =============================================================================
cat > .github/ISSUE_TEMPLATE/task.md << 'EOF'
---
name: Task
about: A task that isn't a feature or bug (docs, refactoring, research, etc.)
title: ''
labels: task
assignees: ''
---

## Summary

*What needs to be done?*

## Context

*Why is this needed? Link to epic if relevant.*

## Acceptance Criteria

- [ ]
- [ ]

## Notes

*Additional context or approach suggestions.*
EOF

# =============================================================================
# .github/PULL_REQUEST_TEMPLATE.md
# =============================================================================
cat > .github/PULL_REQUEST_TEMPLATE.md << 'EOF'
## Summary

*What does this PR do? Keep it brief.*

## Related Issue

Closes #issue-number

## Changes

*Bullet list of what changed.*

-

## Testing

*How was this tested?*

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] *Describe what you tested*

## Screenshots

*If UI changes, include before/after screenshots.*

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings
- [ ] Reviewed my own code before requesting review
EOF

# =============================================================================
# .gitignore
# =============================================================================
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
cdk.out/
.next/

# Environment
.env
.env.local
.env.*.local
*.env

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Testing
coverage/
.nyc_output/

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# CDK
cdk.context.json

# Misc
.cache/
*.tgz
EOF

echo ""
echo "✅ Repository structure created!"
echo ""
echo "Next steps:"
echo "  1. cd into this directory"
echo "  2. git init"
echo "  3. git add ."
echo "  4. git commit -m \"Initial project structure\""
echo "  5. Create repo on GitHub"
echo "  6. git remote add origin <your-repo-url>"
echo "  7. git push -u origin main"
echo ""
echo "Then create GitHub Issues for Epic 0 (see docs/epics/000-project-foundation.md)"
echo ""
