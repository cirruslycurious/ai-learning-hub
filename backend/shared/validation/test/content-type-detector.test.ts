import { describe, it, expect } from "vitest";
import { detectContentType } from "../src/content-type-detector.js";
import { ContentType } from "@ai-learning-hub/types";

describe("Content Type Detector", () => {
  describe("domain mappings", () => {
    it("should detect youtube.com as video", () => {
      expect(detectContentType("https://youtube.com/watch?v=abc")).toBe(
        "video"
      );
    });

    it("should detect www.youtube.com as video", () => {
      expect(detectContentType("https://www.youtube.com/watch?v=abc")).toBe(
        "video"
      );
    });

    it("should detect youtu.be as video", () => {
      expect(detectContentType("https://youtu.be/abc123")).toBe("video");
    });

    it("should detect github.com as github_repo", () => {
      expect(detectContentType("https://github.com/user/repo")).toBe(
        "github_repo"
      );
    });

    it("should detect reddit.com as reddit", () => {
      expect(detectContentType("https://reddit.com/r/typescript")).toBe(
        "reddit"
      );
    });

    it("should detect www.reddit.com as reddit", () => {
      expect(detectContentType("https://www.reddit.com/r/programming")).toBe(
        "reddit"
      );
    });

    it("should detect linkedin.com as linkedin", () => {
      expect(detectContentType("https://linkedin.com/in/username")).toBe(
        "linkedin"
      );
    });

    it("should detect www.linkedin.com as linkedin", () => {
      expect(detectContentType("https://www.linkedin.com/posts/username")).toBe(
        "linkedin"
      );
    });

    it("should detect podcasts.apple.com as podcast", () => {
      expect(
        detectContentType("https://podcasts.apple.com/us/podcast/show-name")
      ).toBe("podcast");
    });

    it("should detect open.spotify.com/show as podcast", () => {
      expect(detectContentType("https://open.spotify.com/show/abc123")).toBe(
        "podcast"
      );
    });

    it("should detect open.spotify.com/episode as podcast", () => {
      expect(detectContentType("https://open.spotify.com/episode/abc123")).toBe(
        "podcast"
      );
    });

    it("should detect spotify.com/show as podcast", () => {
      expect(detectContentType("https://spotify.com/show/abc123")).toBe(
        "podcast"
      );
    });

    it("should detect spotify.com/episode as podcast", () => {
      expect(detectContentType("https://spotify.com/episode/abc123")).toBe(
        "podcast"
      );
    });

    it("should NOT detect open.spotify.com without /show or /episode as podcast", () => {
      expect(detectContentType("https://open.spotify.com/track/abc")).toBe(
        "other"
      );
    });

    it("should detect medium.com as newsletter", () => {
      expect(detectContentType("https://medium.com/@user/post-title")).toBe(
        "newsletter"
      );
    });

    it("should detect substack.com as newsletter", () => {
      expect(
        detectContentType("https://newsletter.substack.com/p/post-title")
      ).toBe("newsletter");
    });
  });

  describe("subdomain matching", () => {
    it("should match subdomains of mapped domains", () => {
      expect(detectContentType("https://old.reddit.com/r/programming")).toBe(
        "reddit"
      );
    });

    it("should match deep subdomains", () => {
      expect(detectContentType("https://m.youtube.com/watch?v=abc")).toBe(
        "video"
      );
    });
  });

  describe("unrecognized domains", () => {
    it("should return 'other' for unknown domains", () => {
      expect(detectContentType("https://example.com/page")).toBe("other");
    });

    it("should return 'other' for random blog", () => {
      expect(detectContentType("https://myblog.wordpress.com/post")).toBe(
        "other"
      );
    });

    it("should return 'other' for malformed URL", () => {
      expect(detectContentType("not-a-url")).toBe("other");
    });
  });

  describe("user-provided override", () => {
    it("should return user-provided contentType over auto-detection", () => {
      expect(
        detectContentType(
          "https://youtube.com/watch?v=abc",
          ContentType.ARTICLE
        )
      ).toBe("article");
    });

    it("should return user-provided contentType for unknown domains", () => {
      expect(
        detectContentType("https://example.com/page", ContentType.TOOL)
      ).toBe("tool");
    });

    it("should use auto-detection when userProvided is undefined", () => {
      expect(
        detectContentType("https://youtube.com/watch?v=abc", undefined)
      ).toBe("video");
    });
  });
});
