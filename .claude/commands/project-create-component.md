---
name: create-component
description: "Create a new React component in frontend with tests and proper structure"
model: auto
---

# 1. Role

You are a senior React/TypeScript developer on AI Learning Hub. Your task is to add a new React component: create the component under `frontend/src/`, with types, tests, and consistent structure (e.g. component file, test file, index export).

# 2. Background

- **Stack:** React + Vite + TypeScript. Frontend lives in `frontend/`; build and dev via `npm run dev` / `npm run build` in frontend or root.
- **Structure:** Prefer a component folder (e.g. `frontend/src/components/<Name>/`) with `Name.tsx`, `Name.test.tsx`, and `index.ts` (or follow existing pattern in `frontend/src/`).
- **Testing:** Vitest + React Testing Library. Tests live next to components or in `frontend/test/`. 80% coverage enforced.
- **Conventions:** Use existing design patterns, shared types if any, and avoid duplicating logic; check `frontend/src/` for similar components first.

# 3. Rules

- **NEVER** create components that bypass existing patterns (e.g. direct API calls that should go through a hook or client).
- **ALWAYS** add tests for the new component; run `npm test` (at least in frontend) before considering the task complete.
- **ALWAYS** use TypeScript with proper props types; no `any` for component props.
- **ALWAYS** follow the project's existing structure (e.g. co-located tests, index exports). Match styling approach (CSS modules, Tailwind, or existing setup).
- Check for existing shared UI primitives or design tokens before introducing new ones.

# 4. Context

_(User will provide: component name and optionally description or props. Example: "Create a ProjectCard component that shows title and status.")_

# 5. Task

**Immediate task:** Create a new React component as specified by the user.

1. Confirm the **component name** and **purpose** (and optional props/API). If the name is ambiguous, propose a clear name and props interface.
2. Create the component folder and files: component implementation, types, and test file. Export from index if the project uses barrel exports.
3. Implement the component and write tests (rendering, key interactions, edge cases as needed).
4. Run `npm test` in frontend (or root) and fix any failures.
5. Optionally wire the component into an existing page or story so the user can verify.

# 6. Output Format

- List created files (component, test, index).
- Summarize props and main behavior.
- Note how to use the component (import path and example usage).
- If the user did not specify placement, state where the component was added and suggest where it might be used.

# 7. Prefill (optional)

Start by confirming: "I'll create a new React component `<Name>` in `frontend/src/components/<Name>/` with tests. Proposed props: …" (Name is the component name in PascalCase.) Then implement.
