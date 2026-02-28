/**
 * Unit tests for scope-resolver module (Story 3.2.6, AC18).
 */
import { describe, it, expect } from "vitest";
import {
  SCOPE_GRANTS,
  resolveScopeGrants,
  checkScopeAccess,
} from "../src/scope-resolver.js";

describe("SCOPE_GRANTS", () => {
  it("defines grants for all 5 named tiers plus 2 legacy values", () => {
    expect(Object.keys(SCOPE_GRANTS)).toEqual(
      expect.arrayContaining([
        "full",
        "*",
        "capture",
        "read",
        "saves:read",
        "saves:write",
        "projects:write",
      ])
    );
    expect(Object.keys(SCOPE_GRANTS)).toHaveLength(7);
  });

  it("full tier grants wildcard", () => {
    expect(SCOPE_GRANTS["full"]).toContain("*");
  });

  it("* tier grants wildcard (backward compat)", () => {
    expect(SCOPE_GRANTS["*"]).toContain("*");
  });

  it("capture tier grants only saves:create", () => {
    expect(SCOPE_GRANTS["capture"]).toEqual(["saves:create"]);
  });

  it("read tier grants all read operations", () => {
    const readGrants = SCOPE_GRANTS["read"];
    expect(readGrants).toContain("saves:read");
    expect(readGrants).toContain("projects:read");
    expect(readGrants).toContain("links:read");
    expect(readGrants).toContain("users:read");
    expect(readGrants).toContain("keys:read");
    expect(readGrants).toHaveLength(5);
  });

  it("saves:write tier grants saves and links operations", () => {
    const grants = SCOPE_GRANTS["saves:write"];
    expect(grants).toContain("saves:read");
    expect(grants).toContain("saves:write");
    expect(grants).toContain("saves:create");
    expect(grants).toContain("links:read");
    expect(grants).toContain("links:write");
    expect(grants).toHaveLength(5);
  });

  it("projects:write tier grants projects read and write", () => {
    expect(SCOPE_GRANTS["projects:write"]).toEqual([
      "projects:read",
      "projects:write",
    ]);
  });

  it("saves:read legacy grants only saves:read (narrower than read tier)", () => {
    expect(SCOPE_GRANTS["saves:read"]).toEqual(["saves:read"]);
  });
});

describe("resolveScopeGrants", () => {
  it("resolves full to wildcard", () => {
    const resolved = resolveScopeGrants(["full"]);
    expect(resolved.has("*")).toBe(true);
  });

  it("resolves * to wildcard (backward compat)", () => {
    const resolved = resolveScopeGrants(["*"]);
    expect(resolved.has("*")).toBe(true);
  });

  it("resolves capture to saves:create only", () => {
    const resolved = resolveScopeGrants(["capture"]);
    expect(resolved).toEqual(new Set(["saves:create"]));
  });

  it("resolves read to all read operations", () => {
    const resolved = resolveScopeGrants(["read"]);
    expect(resolved).toEqual(
      new Set([
        "saves:read",
        "projects:read",
        "links:read",
        "users:read",
        "keys:read",
      ])
    );
  });

  it("resolves saves:write to saves and links operations", () => {
    const resolved = resolveScopeGrants(["saves:write"]);
    expect(resolved).toEqual(
      new Set([
        "saves:read",
        "saves:write",
        "saves:create",
        "links:read",
        "links:write",
      ])
    );
  });

  it("resolves projects:write to projects read and write", () => {
    const resolved = resolveScopeGrants(["projects:write"]);
    expect(resolved).toEqual(new Set(["projects:read", "projects:write"]));
  });

  it("resolves saves:read legacy to saves:read only", () => {
    const resolved = resolveScopeGrants(["saves:read"]);
    expect(resolved).toEqual(new Set(["saves:read"]));
  });

  it("combines multiple tiers additively", () => {
    const resolved = resolveScopeGrants(["capture", "read"]);
    expect(resolved.has("saves:create")).toBe(true);
    expect(resolved.has("saves:read")).toBe(true);
    expect(resolved.has("projects:read")).toBe(true);
    expect(resolved.has("links:read")).toBe(true);
    expect(resolved.has("users:read")).toBe(true);
    expect(resolved.has("keys:read")).toBe(true);
  });

  it("combines saves:write and projects:write", () => {
    const resolved = resolveScopeGrants(["saves:write", "projects:write"]);
    expect(resolved).toEqual(
      new Set([
        "saves:read",
        "saves:write",
        "saves:create",
        "links:read",
        "links:write",
        "projects:read",
        "projects:write",
      ])
    );
  });

  it("drops unrecognized scopes to prevent privilege escalation", () => {
    const resolved = resolveScopeGrants(["analytics:read"]);
    expect(resolved.size).toBe(0);
  });

  it("drops unrecognized scopes while resolving recognized ones", () => {
    const resolved = resolveScopeGrants(["capture", "analytics:read"]);
    expect(resolved.has("saves:create")).toBe(true);
    expect(resolved.has("analytics:read")).toBe(false);
    expect(resolved.size).toBe(1);
  });

  it("returns empty set for empty scopes array", () => {
    const resolved = resolveScopeGrants([]);
    expect(resolved.size).toBe(0);
  });

  it("handles duplicate tiers correctly", () => {
    const resolved = resolveScopeGrants(["read", "read"]);
    expect(resolved).toEqual(
      new Set([
        "saves:read",
        "projects:read",
        "links:read",
        "users:read",
        "keys:read",
      ])
    );
  });
});

describe("checkScopeAccess", () => {
  it("full scope satisfies any required scope", () => {
    expect(checkScopeAccess(["full"], "saves:create")).toBe(true);
    expect(checkScopeAccess(["full"], "saves:read")).toBe(true);
    expect(checkScopeAccess(["full"], "keys:manage")).toBe(true);
    expect(checkScopeAccess(["full"], "projects:write")).toBe(true);
  });

  it("* scope satisfies any required scope (backward compat)", () => {
    expect(checkScopeAccess(["*"], "saves:create")).toBe(true);
    expect(checkScopeAccess(["*"], "keys:manage")).toBe(true);
  });

  it("capture scope satisfies saves:create", () => {
    expect(checkScopeAccess(["capture"], "saves:create")).toBe(true);
  });

  it("capture scope rejects saves:read", () => {
    expect(checkScopeAccess(["capture"], "saves:read")).toBe(false);
  });

  it("capture scope rejects keys:manage", () => {
    expect(checkScopeAccess(["capture"], "keys:manage")).toBe(false);
  });

  it("read scope satisfies saves:read", () => {
    expect(checkScopeAccess(["read"], "saves:read")).toBe(true);
  });

  it("read scope satisfies projects:read", () => {
    expect(checkScopeAccess(["read"], "projects:read")).toBe(true);
  });

  it("read scope rejects saves:write", () => {
    expect(checkScopeAccess(["read"], "saves:write")).toBe(false);
  });

  it("read scope rejects saves:create", () => {
    expect(checkScopeAccess(["read"], "saves:create")).toBe(false);
  });

  it("saves:write scope satisfies saves:read (implicit read from write)", () => {
    expect(checkScopeAccess(["saves:write"], "saves:read")).toBe(true);
  });

  it("saves:write scope satisfies saves:create", () => {
    expect(checkScopeAccess(["saves:write"], "saves:create")).toBe(true);
  });

  it("saves:write scope rejects projects:read", () => {
    expect(checkScopeAccess(["saves:write"], "projects:read")).toBe(false);
  });

  it("saves:write scope rejects keys:manage", () => {
    expect(checkScopeAccess(["saves:write"], "keys:manage")).toBe(false);
  });

  it("projects:write scope satisfies projects:read", () => {
    expect(checkScopeAccess(["projects:write"], "projects:read")).toBe(true);
  });

  it("projects:write scope rejects saves:read", () => {
    expect(checkScopeAccess(["projects:write"], "saves:read")).toBe(false);
  });

  it("combined tiers work correctly", () => {
    const scopes = ["saves:write", "projects:write"];
    expect(checkScopeAccess(scopes, "saves:read")).toBe(true);
    expect(checkScopeAccess(scopes, "saves:write")).toBe(true);
    expect(checkScopeAccess(scopes, "saves:create")).toBe(true);
    expect(checkScopeAccess(scopes, "projects:read")).toBe(true);
    expect(checkScopeAccess(scopes, "projects:write")).toBe(true);
    expect(checkScopeAccess(scopes, "keys:manage")).toBe(false);
  });

  it("empty scopes rejects everything", () => {
    expect(checkScopeAccess([], "saves:read")).toBe(false);
  });

  it("unrecognized scope is dropped (no privilege escalation)", () => {
    expect(checkScopeAccess(["analytics:read"], "analytics:read")).toBe(false);
    expect(checkScopeAccess(["analytics:read"], "saves:read")).toBe(false);
  });

  it("saves:read legacy satisfies saves:read", () => {
    expect(checkScopeAccess(["saves:read"], "saves:read")).toBe(true);
  });

  it("saves:read legacy rejects projects:read (narrower than read tier)", () => {
    expect(checkScopeAccess(["saves:read"], "projects:read")).toBe(false);
  });
});
