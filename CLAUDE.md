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
