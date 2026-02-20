/**
 * scripts/smoke-test/route-registry-bridge.ts
 *
 * CJS/ESM interop bridge: the infra workspace is CommonJS (no "type":"module"),
 * so static named ESM imports from it fail in the ESM smoke-test context.
 * This bridge uses createRequire to load the compiled CJS module and re-exports
 * ROUTE_REGISTRY into the ESM namespace.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const _require = createRequire(import.meta.url);
const _dir = dirname(fileURLToPath(import.meta.url));

// Require the compiled CJS output (infra/dist/config/route-registry.js)
// tsx handles require() for .ts files too, but the dist .js works fine.
 
const mod = _require(
  resolve(_dir, "../../infra/dist/config/route-registry.js")
) as {
  ROUTE_REGISTRY: Array<{
    path: string;
    methods: string[];
    authType: string;
    handlerRef: string;
    epic: string;
  }>;
};

export const ROUTE_REGISTRY = mod.ROUTE_REGISTRY;
