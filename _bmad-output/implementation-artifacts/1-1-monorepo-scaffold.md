# Story 1.1: Monorepo Scaffold

Status: done

## Story

As a **developer (human or AI agent)**,
I want **a monorepo scaffold with npm workspaces for infra, frontend, and backend**,
so that **I can work on all parts of the application in a single repository with shared dependencies and consistent tooling**.

## Acceptance Criteria

1. **AC1: Root package.json configured with npm workspaces**
   - GIVEN a fresh clone of the repository
   - WHEN I run `npm install` at the root
   - THEN all workspace dependencies are installed
   - AND workspace packages can import from each other

2. **AC2: Three workspaces exist with proper package.json**
   - GIVEN the monorepo structure
   - WHEN I inspect the directory
   - THEN `/infra`, `/frontend`, `/backend` directories exist
   - AND each has a valid package.json with appropriate name scope (@ai-learning-hub/\*)

3. **AC3: TypeScript configuration is consistent across workspaces**
   - GIVEN TypeScript files in any workspace
   - WHEN I run `npm run type-check` at root
   - THEN TypeScript validates all workspaces
   - AND strict mode is enabled across all workspaces
   - AND path aliases resolve correctly

4. **AC4: ESLint and Prettier configured at root**
   - GIVEN code files in any workspace
   - WHEN I run `npm run lint` at root
   - THEN all workspaces are linted with consistent rules
   - AND `npm run format` formats all code consistently

5. **AC5: Basic scripts work from root**
   - GIVEN the monorepo is set up
   - WHEN I run standard commands from root
   - THEN `npm test` runs tests across all workspaces
   - AND `npm run build` builds all workspaces
   - AND `npm run lint` lints all workspaces

6. **AC6: Shared package structure prepared**
   - GIVEN the `/shared` directory (inside backend workspace)
   - WHEN I inspect its structure
   - THEN placeholder directories exist for: middleware, logging, db, validation, types
   - AND these will become the @ai-learning-hub/\* packages in Story 1.2

## Tasks / Subtasks

- [x] **Task 1: Initialize root package.json with workspaces** (AC: 1)
  - [x] Create root package.json with npm workspaces configuration
  - [x] Configure workspace paths: ["infra", "frontend", "backend"]
  - [x] Set type: "module" for ES modules
  - [x] Add engines field for Node.js version (20.x)

- [x] **Task 2: Initialize CDK infrastructure workspace** (AC: 2)
  - [x] Run `npx cdk init app --language typescript` in /infra
  - [x] Rename package to @ai-learning-hub/infra
  - [x] Configure bin/app.ts entry point
  - [x] Create placeholder stack structure per ADR-006

- [x] **Task 3: Initialize Vite + React frontend workspace** (AC: 2)
  - [x] Run `npm create vite@latest frontend -- --template react-ts`
  - [x] Rename package to @ai-learning-hub/frontend
  - [x] Add Tailwind CSS configuration
  - [x] Add PWA plugin (vite-plugin-pwa)
  - [x] Configure for Clerk integration placeholder

- [x] **Task 4: Initialize backend workspace** (AC: 2, 6)
  - [x] Create /backend/package.json as @ai-learning-hub/backend
  - [x] Create /backend/functions/ directory structure per ADR-004
  - [x] Create /backend/shared/ placeholder directories
  - [x] Configure esbuild for Lambda bundling

- [x] **Task 5: Configure TypeScript across workspaces** (AC: 3)
  - [x] Create root tsconfig.json with references
  - [x] Create tsconfig.base.json with shared settings (strict mode)
  - [x] Configure each workspace's tsconfig.json to extend base
  - [x] Set up path aliases for @ai-learning-hub/\* imports

- [x] **Task 6: Configure ESLint and Prettier** (AC: 4)
  - [x] Install ESLint with TypeScript plugin at root
  - [x] Install Prettier at root
  - [x] Create eslint.config.js (flat config) with workspace-aware rules (.eslintignore not needed with flat config)
  - [x] Create .prettierrc with consistent formatting
  - [x] Add .prettierignore

- [x] **Task 7: Configure root scripts** (AC: 5)
  - [x] Add "test": "npm run test --workspaces --if-present"
  - [x] Add "build": "npm run build --workspaces --if-present"
  - [x] Add "lint": "eslint . --ext .ts,.tsx"
  - [x] Add "format": "prettier --write \"\*_/_.{ts,tsx,json,md}\""
  - [x] Add "type-check": "tsc --build"

- [x] **Task 8: Create .gitignore and .nvmrc** (AC: 1-6)
  - [x] .gitignore extended (was existing; already had node_modules, dist, cdk.out, .env)
  - [x] Create .nvmrc with Node.js 20 LTS version
  - [x] Add .editorconfig for consistent editor settings

- [x] **Task 9: Validate monorepo setup** (AC: 1-6)
  - [x] Run `npm install` successfully
  - [x] Run `npm run lint` with no errors (empty files OK)
  - [x] Run `npm run type-check` with no errors
  - [x] Verify workspace imports work

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Update story File List: add package-lock.json, note .gitignore was modified not created
- [x] [AI-Review][MEDIUM] Update Task 6 subtask: change ".eslintrc.js" to "eslint.config.js (flat config)" and note .eslintignore not needed with flat config
- [x] [AI-Review][MEDIUM] infra/tsconfig.json: Remove `noUnusedLocals: false` and `noUnusedParameters: false` overrides to maintain strict consistency [infra/tsconfig.json:14-15]
- [x] [AI-Review][MEDIUM] backend/tsconfig.json: Add `test/**/*` to include array for test type-checking [backend/tsconfig.json:22]
- [x] [AI-Review][LOW] .editorconfig: Add `insert_final_newline = true` for consistent EOF handling
- [x] [AI-Review][LOW] Placeholder tests noted - acceptable for scaffold, real tests in future stories

### Review Follow-ups Round 2 (AI - 2026-02-04)

- [x] [AI-Review][MEDIUM] infra/cdk.json: Add recommended CDK 2.x security feature flags (@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId, @aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021, @aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy, etc.) [infra/cdk.json:16-19]
- [x] [AI-Review][MEDIUM] frontend/index.html: Create frontend/public/ directory and add a favicon, or remove the broken vite.svg reference [frontend/public/vite.svg added]
- [x] [AI-Review][MEDIUM] .gitignore: Add entries for frontend build artifacts (dist-node/, *.tsbuildinfo) to prevent accidental commits
- [x] [AI-Review][MEDIUM] eslint.config.js: Enable type-aware linting — deferred; projectService requires all config/test files in tsconfig or allowDefaultProject; left comment for future follow-up
- [x] [AI-Review][LOW] frontend/package.json: Remove deprecated --ext flag from lint script (not needed with ESLint 9 flat config)
- [x] [AI-Review][LOW] backend/package.json: Remove deprecated --ext flag from lint script (not needed with ESLint 9 flat config)
- [x] [AI-Review][LOW] tsconfig.json: Keep "files": [] — required for solution-style project references; removing it broke tsc --build
- [x] [AI-Review][LOW] infra/bin/app.ts: Removed shebang line (ts-node invoked via cdk.json)

## Dev Notes

### Architecture Compliance

This story implements the foundation per:

- **ADR-006: Multi-Stack CDK Decomposition** - /infra structure prepared for 15+ stacks
- **ADR-004: Lambda Per Concern** - /backend/functions/ prepared for per-domain handlers
- **ADR-015: Lambda Layers for Shared Code** - /backend/shared/ prepared for @ai-learning-hub/\* packages

### Technical Stack (from Architecture)

| Component       | Technology   | Version              |
| --------------- | ------------ | -------------------- |
| Runtime         | Node.js      | 20.x LTS             |
| Package Manager | npm          | 10.x (via Node 20)   |
| TypeScript      | TypeScript   | 5.x                  |
| Frontend        | React + Vite | React 18.x, Vite 5.x |
| Infrastructure  | AWS CDK      | 2.x                  |
| Testing         | Vitest       | 1.x                  |

### Directory Structure Target

```
ai-learning-hub/
├── package.json              # Root with workspaces
├── tsconfig.json             # Root TS config with references
├── tsconfig.base.json        # Shared TS settings
├── .eslintrc.js              # Root ESLint config
├── .prettierrc               # Prettier config
├── .nvmrc                    # Node version
├── .gitignore                # Git ignore rules
│
├── /infra                    # AWS CDK (TypeScript)
│   ├── package.json          # @ai-learning-hub/infra
│   ├── tsconfig.json         # Extends base
│   ├── bin/app.ts            # CDK app entry
│   └── lib/stacks/           # Stack structure (empty)
│       ├── core/
│       ├── auth/
│       ├── api/
│       ├── workflows/
│       ├── observability/
│       └── pipeline/
│
├── /frontend                 # Vite + React (TypeScript)
│   ├── package.json          # @ai-learning-hub/frontend
│   ├── tsconfig.json         # Extends base
│   ├── vite.config.ts        # Vite + PWA config
│   ├── tailwind.config.js    # Tailwind CSS
│   └── src/                  # Source files
│       ├── App.tsx
│       ├── main.tsx
│       └── index.css
│
└── /backend                  # Lambda handlers (TypeScript)
    ├── package.json          # @ai-learning-hub/backend
    ├── tsconfig.json         # Extends base
    ├── functions/            # Lambda function structure
    │   ├── saves/
    │   ├── projects/
    │   ├── links/
    │   ├── search/
    │   ├── content/
    │   ├── admin/
    │   └── enrichment/
    └── shared/               # Shared utilities (placeholders)
        ├── middleware/
        ├── logging/
        ├── db/
        ├── validation/
        └── types/
```

### Key Implementation Notes

1. **npm workspaces over yarn/pnpm**: Project uses npm workspaces for simplicity and native Node.js support. No additional tooling required.

2. **TypeScript Project References**: Use `--build` mode for incremental compilation. Each workspace has its own tsconfig.json extending the base.

3. **ESLint v9 Flat Config**: Consider using the new flat config format (`eslint.config.js`) for better performance. Fall back to `.eslintrc.js` if compatibility issues arise.

4. **CDK Initialization**: The `cdk init` command creates its own structure. Adapt it to match ADR-006 multi-stack layout.

5. **Vite PWA Plugin**: Install `vite-plugin-pwa` and `workbox-window` for PWA support per ADR-011/012.

6. **No Lambda code yet**: The /backend/functions/ directories are placeholders. Actual handlers come in later stories.

### Testing Requirements

- **Unit Tests**: Each workspace should have a basic test file that passes
- **Coverage**: N/A for this story (no business logic)
- **Integration Tests**: Verify workspace imports work across boundaries

### Project Structure Notes

- Alignment with unified project structure: Full compliance with architecture document
- All paths match ADR-006 (infra structure) and ADR-004 (backend structure)
- Shared code location (/backend/shared/) aligns with ADR-015 (Lambda Layers)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-006] - Multi-Stack CDK Decomposition
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-004] - Lambda Per Concern
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-015] - Lambda Layers for Shared Code
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure] - Directory layout
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1] - Foundation epic context

### Dependencies

- **Blocks**: Story 1.2 (Shared Lambda Layer) - needs this scaffold to exist
- **Blocked by**: None - this is the first story

### AWS Account Note

**Not needed for this story.** This story creates local project structure only - no AWS deployments occur.

AWS account configuration will be required starting with:

- **Story 1.7 (CI/CD Pipeline)** - GitHub Actions OIDC integration
- **Story 1.8 (DynamoDB + S3 Infrastructure)** - First actual CDK deployment

Ensure AWS account ID, region, and credentials are configured before starting those stories.

### Out of Scope

- Actual Lambda function implementations (Story 1.2+)
- CI/CD pipeline setup (Story 1.7)
- Database infrastructure (Story 1.8)
- CLAUDE.md and .claude/ directory (Story 1.3)
- Any deployed infrastructure

## Dev Agent Record

### Agent Model Used

Cursor / bmad-bmm-dev-story workflow

### Debug Log References

(none)

### Completion Notes List

- Root package.json with workspaces `infra`, `frontend`, `backend`; type module; engines node >=20.
- Infra: CDK app with bin/app.ts and lib/stacks/{core,auth,api,workflows,observability,pipeline} placeholders; @ai-learning-hub/infra; vitest test.
- Frontend: Vite + React 18 + TypeScript; Tailwind; vite-plugin-pwa; @ai-learning-hub/frontend; Vitest + jsdom + @testing-library/react.
- Backend: @ai-learning-hub/backend; functions/{saves,projects,links,search,content,admin,enrichment}; shared/{middleware,logging,db,validation,types}; placeholder shared/types/index.ts; Vitest.
- TypeScript: tsconfig.base.json (strict); root tsconfig.json with references; each workspace extends base and has composite.
- ESLint: flat config (eslint.config.js) with typescript-eslint; ignores .claude/, dist/, _bmad/, etc.
- Prettier: .prettierrc, .prettierignore. .nvmrc (20), .editorconfig.
- Validated: npm install, npm run lint, npm run type-check, npm test, npm run build all pass.
- Placeholder tests in each workspace are acceptable for scaffold; real tests in future stories.

### File List

- package.json (root)
- package-lock.json (root; generated by npm install)
- tsconfig.json (root)
- tsconfig.base.json (root)
- eslint.config.js (root)
- .prettierrc
- .prettierignore
- .nvmrc
- .editorconfig
- infra/package.json
- infra/tsconfig.json
- infra/cdk.json
- infra/bin/app.ts
- infra/lib/stacks/core/.gitkeep
- infra/lib/stacks/auth/.gitkeep
- infra/lib/stacks/api/.gitkeep
- infra/lib/stacks/workflows/.gitkeep
- infra/lib/stacks/observability/.gitkeep
- infra/lib/stacks/pipeline/.gitkeep
- infra/test/app.test.ts
- frontend/package.json
- frontend/tsconfig.json
- frontend/tsconfig.node.json
- frontend/vite.config.ts
- frontend/vitest.config.ts
- frontend/tailwind.config.js
- frontend/postcss.config.js
- frontend/index.html
- frontend/public/vite.svg
- frontend/src/main.tsx
- frontend/src/App.tsx
- frontend/src/index.css
- frontend/src/vite-env.d.ts
- frontend/test/setup.ts
- frontend/test/App.test.tsx
- backend/package.json
- backend/tsconfig.json
- backend/vitest.config.ts
- backend/shared/types/index.ts
- backend/functions/saves/.gitkeep
- backend/functions/projects/.gitkeep
- backend/functions/links/.gitkeep
- backend/functions/search/.gitkeep
- backend/functions/content/.gitkeep
- backend/functions/admin/.gitkeep
- backend/functions/enrichment/.gitkeep
- backend/shared/middleware/.gitkeep
- backend/shared/logging/.gitkeep
- backend/shared/db/.gitkeep
- backend/shared/validation/.gitkeep
- backend/shared/types/.gitkeep
- backend/test/placeholder.test.ts
