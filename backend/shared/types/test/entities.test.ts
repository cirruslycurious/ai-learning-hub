import { describe, it, expect } from "vitest";
import {
  ResourceType,
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
  describe("ResourceType", () => {
    it("should have all resource types", () => {
      expect(ResourceType.ARTICLE).toBe("ARTICLE");
      expect(ResourceType.VIDEO).toBe("VIDEO");
      expect(ResourceType.PODCAST).toBe("PODCAST");
      expect(ResourceType.TUTORIAL).toBe("TUTORIAL");
      expect(ResourceType.DOCUMENTATION).toBe("DOCUMENTATION");
      expect(ResourceType.REPOSITORY).toBe("REPOSITORY");
      expect(ResourceType.OTHER).toBe("OTHER");
    });
  });

  describe("TutorialStatus", () => {
    it("should have all tutorial statuses", () => {
      expect(TutorialStatus.SAVED).toBe("SAVED");
      expect(TutorialStatus.STARTED).toBe("STARTED");
      expect(TutorialStatus.IN_PROGRESS).toBe("IN_PROGRESS");
      expect(TutorialStatus.COMPLETED).toBe("COMPLETED");
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
    it("should accept valid save shape", () => {
      const save: Save = {
        userId: "user_123",
        saveId: "save_456",
        url: "https://example.com/article",
        title: "Test Article",
        resourceType: ResourceType.ARTICLE,
        tutorialStatus: TutorialStatus.SAVED,
        createdAt: "2026-02-04T12:00:00.000Z",
        updatedAt: "2026-02-04T12:00:00.000Z",
      };

      expect(save.url).toBe("https://example.com/article");
      expect(save.resourceType).toBe(ResourceType.ARTICLE);
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
