/**
 * Content type detection based on URL domain mapping (Story 3.1a)
 *
 * Auto-detects content type from known domain patterns.
 * User-provided contentType always takes precedence over auto-detection.
 */
import { ContentType } from "@ai-learning-hub/types";

interface DomainRule {
  domain: string;
  pathPrefix?: string;
  contentType: ContentType;
}

/**
 * Domain-to-content-type mapping table.
 * Extensible: add new entries without code changes.
 * Order matters for domains with path-specific rules (more specific first).
 */
const DOMAIN_RULES: DomainRule[] = [
  // Video
  { domain: "youtube.com", contentType: ContentType.VIDEO },
  { domain: "youtu.be", contentType: ContentType.VIDEO },

  // GitHub
  { domain: "github.com", contentType: ContentType.GITHUB_REPO },

  // Reddit
  { domain: "reddit.com", contentType: ContentType.REDDIT },

  // LinkedIn
  { domain: "linkedin.com", contentType: ContentType.LINKEDIN },

  // Podcast (path-specific rules first)
  {
    domain: "open.spotify.com",
    pathPrefix: "/show",
    contentType: ContentType.PODCAST,
  },
  {
    domain: "open.spotify.com",
    pathPrefix: "/episode",
    contentType: ContentType.PODCAST,
  },
  {
    domain: "spotify.com",
    pathPrefix: "/show",
    contentType: ContentType.PODCAST,
  },
  {
    domain: "spotify.com",
    pathPrefix: "/episode",
    contentType: ContentType.PODCAST,
  },
  {
    domain: "podcasts.apple.com",
    contentType: ContentType.PODCAST,
  },

  // Newsletter
  { domain: "medium.com", contentType: ContentType.NEWSLETTER },
  { domain: "substack.com", contentType: ContentType.NEWSLETTER },
];

/**
 * Detect content type from URL domain pattern.
 * User-provided contentType always takes precedence.
 *
 * @param url - The URL to detect content type for (handles both normalized and raw URLs)
 * @param userProvided - Optional user-provided content type override
 * @returns The detected ContentType
 */
export function detectContentType(
  url: string,
  userProvided?: ContentType
): ContentType {
  // User-provided always wins
  if (userProvided) {
    return userProvided;
  }

  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    pathname = parsed.pathname;
  } catch {
    return ContentType.OTHER;
  }

  for (const rule of DOMAIN_RULES) {
    // Check if hostname matches or is a subdomain of the rule domain
    if (hostname === rule.domain || hostname.endsWith(`.${rule.domain}`)) {
      // If rule has pathPrefix, check that too
      if (rule.pathPrefix) {
        if (pathname.startsWith(rule.pathPrefix)) {
          return rule.contentType;
        }
        // Path doesn't match, continue checking other rules
        continue;
      }
      return rule.contentType;
    }
  }

  return ContentType.OTHER;
}
