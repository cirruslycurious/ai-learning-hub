import { describe, it, expect } from "vitest";
import {
  CONTENT_TYPE_ICONS,
  getContentTypeIcon,
  type ContentType,
} from "../../src/lib/content-type-icons";

describe("content-type-icons", () => {
  const ALL_TYPES: ContentType[] = [
    "video",
    "podcast",
    "article",
    "github_repo",
    "repository",
    "newsletter",
    "tool",
    "reddit",
    "linkedin",
    "course",
    "documentation",
    "other",
  ];

  it("exports CONTENT_TYPE_ICONS with all expected types", () => {
    for (const type of ALL_TYPES) {
      expect(CONTENT_TYPE_ICONS[type]).toBeDefined();
    }
  });

  it("maps each type to a valid React component", () => {
    for (const type of ALL_TYPES) {
      const icon = CONTENT_TYPE_ICONS[type];
      // Lucide icons are forwardRef objects with render function
      expect(typeof icon === "function" || typeof icon === "object").toBe(true);
    }
  });

  describe("getContentTypeIcon", () => {
    it("returns the correct icon for each known type", () => {
      for (const type of ALL_TYPES) {
        const icon = getContentTypeIcon(type);
        expect(icon).toBe(CONTENT_TYPE_ICONS[type]);
      }
    });

    it("returns Link2 fallback for unknown types", () => {
      const fallback = getContentTypeIcon("unknown_type");
      expect(fallback).toBe(CONTENT_TYPE_ICONS.other);
    });

    it("returns Link2 fallback for empty string", () => {
      const fallback = getContentTypeIcon("");
      expect(fallback).toBe(CONTENT_TYPE_ICONS.other);
    });
  });
});
