import { describe, it, expect } from "vitest";
import {
  ContentType,
  TutorialStatus,
  ProjectStatus,
  EnrichmentStatus,
} from "../src/entities.js";
import type {
  User,
  Save,
  Project,
  Content,
  ApiKey,
  InviteCode,
} from "../src/entities.js";

describe("Entity Enums", () => {
  describe("ContentType", () => {
    it("should have all content types with lowercase values", () => {
      expect(ContentType.ARTICLE).toBe("article");
      expect(ContentType.VIDEO).toBe("video");
      expect(ContentType.PODCAST).toBe("podcast");
      expect(ContentType.GITHUB_REPO).toBe("github_repo");
      expect(ContentType.NEWSLETTER).toBe("newsletter");
      expect(ContentType.TOOL).toBe("tool");
      expect(ContentType.REDDIT).toBe("reddit");
      expect(ContentType.LINKEDIN).toBe("linkedin");
      expect(ContentType.OTHER).toBe("other");
    });

    it("should have exactly 9 content types", () => {
      const values = Object.values(ContentType);
      expect(values).toHaveLength(9);
    });
  });

  describe("TutorialStatus", () => {
    it("should have all tutorial statuses with lowercase values", () => {
      expect(TutorialStatus.SAVED).toBe("saved");
      expect(TutorialStatus.STARTED).toBe("started");
      expect(TutorialStatus.IN_PROGRESS).toBe("in-progress");
      expect(TutorialStatus.COMPLETED).toBe("completed");
    });
  });

  describe("ProjectStatus", () => {
    it("should have all project statuses", () => {
      expect(ProjectStatus.EXPLORING).toBe("EXPLORING");
      expect(ProjectStatus.BUILDING).toBe("BUILDING");
      expect(ProjectStatus.PAUSED).toBe("PAUSED");
      expect(ProjectStatus.COMPLETED).toBe("COMPLETED");
    });
  });

  describe("EnrichmentStatus", () => {
    it("should have all enrichment statuses", () => {
      expect(EnrichmentStatus.PENDING).toBe("PENDING");
      expect(EnrichmentStatus.PROCESSING).toBe("PROCESSING");
      expect(EnrichmentStatus.COMPLETED).toBe("COMPLETED");
      expect(EnrichmentStatus.FAILED).toBe("FAILED");
    });
  });
});

describe("Entity Types", () => {
  describe("User", () => {
    it("should accept valid user shape", () => {
      const user: User = {
        userId: "user_123",
        email: "test@example.com",
        displayName: "Test User",
        avatarUrl: "https://example.com/avatar.png",
        roles: ["user"],
        createdAt: "2026-02-04T12:00:00.000Z",
        updatedAt: "2026-02-04T12:00:00.000Z",
      };

      expect(user.userId).toBe("user_123");
      expect(user.roles).toContain("user");
    });
  });

  describe("Save", () => {
    it("should accept valid save shape with full Epic 3 schema", () => {
      const save: Save = {
        userId: "user_123",
        saveId: "01HXXXXXXXXXXXXXXX",
        url: "https://www.example.com/article",
        normalizedUrl: "https://example.com/article",
        urlHash: "abc123def456",
        title: "Test Article",
        userNotes: "Great article about testing",
        contentType: ContentType.ARTICLE,
        tags: ["testing", "typescript"],
        isTutorial: false,
        tutorialStatus: null,
        linkedProjectCount: 0,
        createdAt: "2026-02-04T12:00:00.000Z",
        updatedAt: "2026-02-04T12:00:00.000Z",
      };

      expect(save.url).toBe("https://www.example.com/article");
      expect(save.normalizedUrl).toBe("https://example.com/article");
      expect(save.contentType).toBe(ContentType.ARTICLE);
      expect(save.tags).toHaveLength(2);
      expect(save.isTutorial).toBe(false);
      expect(save.linkedProjectCount).toBe(0);
    });

    it("should accept save with optional fields omitted", () => {
      const save: Save = {
        userId: "user_123",
        saveId: "01HXXXXXXXXXXXXXXX",
        url: "https://example.com",
        normalizedUrl: "https://example.com/",
        urlHash: "sha256hash",
        contentType: ContentType.OTHER,
        tags: [],
        isTutorial: false,
        linkedProjectCount: 0,
        createdAt: "2026-02-04T12:00:00.000Z",
        updatedAt: "2026-02-04T12:00:00.000Z",
      };

      expect(save.title).toBeUndefined();
      expect(save.userNotes).toBeUndefined();
      expect(save.lastAccessedAt).toBeUndefined();
      expect(save.enrichedAt).toBeUndefined();
      expect(save.deletedAt).toBeUndefined();
    });
  });

  describe("Project", () => {
    it("should accept valid project shape", () => {
      const project: Project = {
        userId: "user_123",
        projectId: "proj_789",
        name: "My Project",
        description: "A test project",
        status: ProjectStatus.EXPLORING,
        tags: ["typescript", "aws"],
        createdAt: "2026-02-04T12:00:00.000Z",
        updatedAt: "2026-02-04T12:00:00.000Z",
      };

      expect(project.name).toBe("My Project");
      expect(project.status).toBe(ProjectStatus.EXPLORING);
      expect(project.tags).toHaveLength(2);
    });
  });

  describe("Content", () => {
    it("should accept valid content shape", () => {
      const content: Content = {
        urlHash: "abc123",
        url: "https://example.com",
        title: "Example Site",
        enrichmentStatus: EnrichmentStatus.COMPLETED,
      };

      expect(content.urlHash).toBe("abc123");
      expect(content.enrichmentStatus).toBe(EnrichmentStatus.COMPLETED);
    });
  });

  describe("ApiKey", () => {
    it("should accept valid API key shape", () => {
      const apiKey: ApiKey = {
        userId: "user_123",
        keyId: "key_456",
        name: "My API Key",
        keyHash: "hashed_value",
        scopes: ["*"],
        createdAt: "2026-02-04T12:00:00.000Z",
        updatedAt: "2026-02-04T12:00:00.000Z",
      };

      expect(apiKey.name).toBe("My API Key");
      expect(apiKey.scopes).toContain("*");
    });
  });

  describe("InviteCode", () => {
    it("should accept valid invite code shape", () => {
      const inviteCode: InviteCode = {
        code: "ABC123",
        createdBy: "user_123",
        createdAt: "2026-02-04T12:00:00.000Z",
      };

      expect(inviteCode.code).toBe("ABC123");
      expect(inviteCode.usedBy).toBeUndefined();
    });
  });
});
