import { describe, it, expect } from "vitest";
import { buildPaginationLinks } from "./pagination.js";

describe("buildPaginationLinks", () => {
  it("builds self link with query params", () => {
    const result = buildPaginationLinks(
      "/users/api-keys",
      { limit: "25" },
      null
    );
    expect(result.self).toBe("/users/api-keys?limit=25");
    expect(result.next).toBeNull();
  });

  it("builds next link when cursor is provided", () => {
    const result = buildPaginationLinks(
      "/users/api-keys",
      { limit: "10" },
      "abc123"
    );
    expect(result.self).toBe("/users/api-keys?limit=10");
    expect(result.next).toBe("/users/api-keys?limit=10&cursor=abc123");
  });

  it("preserves all query params in both links", () => {
    const result = buildPaginationLinks(
      "/saves",
      { limit: "25", contentType: "article", sort: "createdAt", order: "desc" },
      "next-cursor"
    );
    expect(result.self).toContain("limit=25");
    expect(result.self).toContain("contentType=article");
    expect(result.self).toContain("sort=createdAt");
    expect(result.self).toContain("order=desc");
    expect(result.next).toContain("cursor=next-cursor");
    expect(result.next).toContain("limit=25");
    expect(result.next).toContain("contentType=article");
  });

  it("returns basePath without query string when params are empty", () => {
    const result = buildPaginationLinks("/saves", {}, null);
    expect(result.self).toBe("/saves");
    expect(result.next).toBeNull();
  });

  it("returns next with cursor even when params are empty", () => {
    const result = buildPaginationLinks("/saves", {}, "cursor-val");
    expect(result.self).toBe("/saves");
    expect(result.next).toBe("/saves?cursor=cursor-val");
  });
});
