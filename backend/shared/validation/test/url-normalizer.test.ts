import { describe, it, expect } from "vitest";
import { normalizeUrl, NormalizeError } from "../src/url-normalizer.js";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

describe("URL Normalizer", () => {
  describe("basic normalization", () => {
    it("should lowercase scheme and host", () => {
      const result = normalizeUrl("HTTPS://EXAMPLE.COM/Path");
      expect(result.normalizedUrl).toBe("https://example.com/Path");
    });

    it("should preserve path case", () => {
      const result = normalizeUrl("https://example.com/CamelCase/Path");
      expect(result.normalizedUrl).toBe("https://example.com/CamelCase/Path");
    });

    it("should add trailing slash to root-only URLs", () => {
      const result = normalizeUrl("https://example.com");
      expect(result.normalizedUrl).toBe("https://example.com/");
    });

    it("should preserve trailing slash on root path", () => {
      const result = normalizeUrl("https://example.com/");
      expect(result.normalizedUrl).toBe("https://example.com/");
    });

    it("should preserve non-root paths as-is (no adding trailing slash)", () => {
      const result = normalizeUrl("https://example.com/path");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });

    it("should preserve existing trailing slash on non-root paths", () => {
      const result = normalizeUrl("https://example.com/path/");
      expect(result.normalizedUrl).toBe("https://example.com/path/");
    });
  });

  describe("scheme preservation", () => {
    it("should preserve http scheme (not rewrite to https)", () => {
      const result = normalizeUrl("http://example.com/path");
      expect(result.normalizedUrl).toBe("http://example.com/path");
    });

    it("should preserve https scheme", () => {
      const result = normalizeUrl("https://example.com/path");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });
  });

  describe("default port removal", () => {
    it("should remove port 80 for http", () => {
      const result = normalizeUrl("http://example.com:80/path");
      expect(result.normalizedUrl).toBe("http://example.com/path");
    });

    it("should remove port 443 for https", () => {
      const result = normalizeUrl("https://example.com:443/path");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });

    it("should keep non-default port for http", () => {
      const result = normalizeUrl("http://example.com:8080/path");
      expect(result.normalizedUrl).toBe("http://example.com:8080/path");
    });

    it("should keep non-default port for https", () => {
      const result = normalizeUrl("https://example.com:8443/path");
      expect(result.normalizedUrl).toBe("https://example.com:8443/path");
    });

    it("should keep port 443 for http (non-default)", () => {
      const result = normalizeUrl("http://example.com:443/path");
      expect(result.normalizedUrl).toBe("http://example.com:443/path");
    });

    it("should keep port 80 for https (non-default)", () => {
      const result = normalizeUrl("https://example.com:80/path");
      expect(result.normalizedUrl).toBe("https://example.com:80/path");
    });
  });

  describe("www stripping", () => {
    it("should strip www. prefix", () => {
      const result = normalizeUrl("https://www.example.com/path");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });

    it("should not strip www from non-prefix position", () => {
      const result = normalizeUrl("https://notwww.example.com/path");
      expect(result.normalizedUrl).toBe("https://notwww.example.com/path");
    });

    it("should handle www-only domain", () => {
      // www.com → com (after stripping)
      const result = normalizeUrl("https://www.com/path");
      expect(result.normalizedUrl).toBe("https://com/path");
    });
  });

  describe("path segment resolution", () => {
    it("should resolve . segments", () => {
      const result = normalizeUrl("https://example.com/a/./b/path");
      expect(result.normalizedUrl).toBe("https://example.com/a/b/path");
    });

    it("should resolve .. segments", () => {
      const result = normalizeUrl("https://example.com/a/b/../c");
      expect(result.normalizedUrl).toBe("https://example.com/a/c");
    });

    it("should resolve complex . and .. combinations", () => {
      const result = normalizeUrl("https://example.com/a/b/c/../../d/./e");
      expect(result.normalizedUrl).toBe("https://example.com/a/d/e");
    });
  });

  describe("query parameter sorting", () => {
    it("should sort query params alphabetically", () => {
      const result = normalizeUrl("https://example.com/path?z=1&a=2&m=3");
      expect(result.normalizedUrl).toBe("https://example.com/path?a=2&m=3&z=1");
    });

    it("should handle empty query string", () => {
      const result = normalizeUrl("https://example.com/path");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });

    it("should handle single query param", () => {
      const result = normalizeUrl("https://example.com/path?key=value");
      expect(result.normalizedUrl).toBe("https://example.com/path?key=value");
    });

    it("should preserve query param values", () => {
      const result = normalizeUrl(
        "https://example.com/path?b=hello%20world&a=test"
      );
      expect(result.normalizedUrl).toBe(
        "https://example.com/path?a=test&b=hello+world"
      );
    });
  });

  describe("fragment removal", () => {
    it("should remove fragment", () => {
      const result = normalizeUrl("https://example.com/path#section");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });

    it("should remove fragment with query", () => {
      const result = normalizeUrl("https://example.com/path?key=val#section");
      expect(result.normalizedUrl).toBe("https://example.com/path?key=val");
    });
  });

  describe("percent-encoding normalization", () => {
    it("should decode %7E to ~", () => {
      const result = normalizeUrl("https://example.com/path%7Efile");
      expect(result.normalizedUrl).toBe("https://example.com/path~file");
    });

    it("should decode %2D to -", () => {
      const result = normalizeUrl("https://example.com/path%2Dfile");
      expect(result.normalizedUrl).toBe("https://example.com/path-file");
    });

    it("should decode %2E to .", () => {
      const result = normalizeUrl("https://example.com/path%2Efile");
      expect(result.normalizedUrl).toBe("https://example.com/path.file");
    });

    it("should decode %5F to _", () => {
      const result = normalizeUrl("https://example.com/path%5Ffile");
      expect(result.normalizedUrl).toBe("https://example.com/path_file");
    });

    it("should decode uppercase letter percent-encoding (%41 = A)", () => {
      const result = normalizeUrl("https://example.com/%41%42%43");
      expect(result.normalizedUrl).toBe("https://example.com/ABC");
    });

    it("should decode lowercase letter percent-encoding (%61 = a)", () => {
      const result = normalizeUrl("https://example.com/%61%62%63");
      expect(result.normalizedUrl).toBe("https://example.com/abc");
    });

    it("should decode digit percent-encoding (%30 = 0)", () => {
      const result = normalizeUrl("https://example.com/%30%31%32");
      expect(result.normalizedUrl).toBe("https://example.com/012");
    });

    it("should NOT decode reserved character percent-encoding (%2F = /)", () => {
      const result = normalizeUrl("https://example.com/a%2Fb");
      expect(result.normalizedUrl).toBe("https://example.com/a%2Fb");
    });

    it("should normalize percent-encoding hex to uppercase", () => {
      const result = normalizeUrl("https://example.com/path%2ftest");
      expect(result.normalizedUrl).toBe("https://example.com/path%2Ftest");
    });

    it("should handle mixed percent-encoding", () => {
      const result = normalizeUrl("https://example.com/%7efile%2Fpath");
      expect(result.normalizedUrl).toBe("https://example.com/~file%2Fpath");
    });
  });

  describe("IDN to punycode", () => {
    it("should convert IDN domain to punycode", () => {
      const result = normalizeUrl("https://münchen.de/path");
      expect(result.normalizedUrl).toBe("https://xn--mnchen-3ya.de/path");
    });

    it("should handle already-punycode domains", () => {
      const result = normalizeUrl("https://xn--mnchen-3ya.de/path");
      expect(result.normalizedUrl).toBe("https://xn--mnchen-3ya.de/path");
    });

    it("should handle ASCII-only domains unchanged", () => {
      const result = normalizeUrl("https://example.com/path");
      expect(result.normalizedUrl).toBe("https://example.com/path");
    });
  });

  describe("embedded credential rejection", () => {
    it("should reject URL with user:pass@", () => {
      expect(() => normalizeUrl("https://user:pass@example.com/path")).toThrow(
        "URLs with embedded credentials are not allowed"
      );
    });

    it("should reject URL with user@ (no password)", () => {
      expect(() => normalizeUrl("https://user@example.com/path")).toThrow(
        "URLs with embedded credentials are not allowed"
      );
    });

    it("should accept URL without credentials", () => {
      expect(() => normalizeUrl("https://example.com/path")).not.toThrow();
    });
  });

  describe("scheme validation", () => {
    it("should reject ftp scheme", () => {
      expect(() => normalizeUrl("ftp://example.com/file")).toThrow(
        "Only http and https URLs are supported"
      );
    });

    it("should reject mailto scheme", () => {
      expect(() => normalizeUrl("mailto:user@example.com")).toThrow(
        "Only http and https URLs are supported"
      );
    });

    it("should reject file scheme", () => {
      expect(() => normalizeUrl("file:///etc/passwd")).toThrow(
        "Only http and https URLs are supported"
      );
    });
  });

  describe("empty/malformed URL rejection", () => {
    it("should reject empty string", () => {
      expect(() => normalizeUrl("")).toThrow("A valid URL is required");
    });

    it("should reject whitespace-only string", () => {
      expect(() => normalizeUrl("   ")).toThrow("A valid URL is required");
    });

    it("should reject malformed URL", () => {
      expect(() => normalizeUrl("not-a-url")).toThrow(
        "A valid URL is required"
      );
    });

    it("should reject null-ish values", () => {
      expect(() => normalizeUrl(null as unknown as string)).toThrow(
        "A valid URL is required"
      );
      expect(() => normalizeUrl(undefined as unknown as string)).toThrow(
        "A valid URL is required"
      );
    });
  });

  describe("URL hash generation", () => {
    it("should generate consistent SHA-256 hash", () => {
      const result1 = normalizeUrl("https://example.com/path");
      const result2 = normalizeUrl("https://example.com/path");
      expect(result1.urlHash).toBe(result2.urlHash);
      expect(result1.urlHash).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it("should generate different hashes for different URLs", () => {
      const result1 = normalizeUrl("https://example.com/path1");
      const result2 = normalizeUrl("https://example.com/path2");
      expect(result1.urlHash).not.toBe(result2.urlHash);
    });

    it("should generate same hash for URLs that normalize to same form", () => {
      const result1 = normalizeUrl("https://www.example.com/path?b=2&a=1");
      const result2 = normalizeUrl("https://example.com/path?a=1&b=2");
      expect(result1.urlHash).toBe(result2.urlHash);
    });
  });

  describe("NormalizeError", () => {
    it("should be an instance of NormalizeError and Error", () => {
      expect(() => normalizeUrl("")).toThrow(NormalizeError);
    });

    it("should be an instance of AppError", () => {
      expect(() => normalizeUrl("")).toThrow(AppError);
    });

    it("should have name NormalizeError", () => {
      expect.assertions(1);
      try {
        normalizeUrl("");
      } catch (e) {
        expect((e as NormalizeError).name).toBe("NormalizeError");
      }
    });

    it("should have code VALIDATION_ERROR per ADR-008", () => {
      expect.assertions(1);
      try {
        normalizeUrl("");
      } catch (e) {
        expect((e as NormalizeError).code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });
  });

  describe("complex real-world URLs", () => {
    it("should normalize YouTube URL", () => {
      const result = normalizeUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf#t=30"
      );
      expect(result.normalizedUrl).toBe(
        "https://youtube.com/watch?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&v=dQw4w9WgXcQ"
      );
    });

    it("should normalize GitHub URL", () => {
      const result = normalizeUrl(
        "HTTPS://WWW.GITHUB.COM/user/repo/blob/main/file.ts"
      );
      expect(result.normalizedUrl).toBe(
        "https://github.com/user/repo/blob/main/file.ts"
      );
    });

    it("should handle URL with all normalizable components", () => {
      const result = normalizeUrl(
        "HTTP://WWW.EXAMPLE.COM:80/a/../b/./c?z=3&a=1#frag"
      );
      expect(result.normalizedUrl).toBe("http://example.com/b/c?a=1&z=3");
    });

    it("should handle URL with encoded spaces in query", () => {
      const result = normalizeUrl("https://example.com/search?q=hello%20world");
      expect(result.normalizedUrl).toBe(
        "https://example.com/search?q=hello+world"
      );
    });
  });
});
