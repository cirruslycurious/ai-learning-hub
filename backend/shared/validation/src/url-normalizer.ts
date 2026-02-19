/**
 * URL normalization and hash generation (Story 3.1a)
 *
 * Algorithm inspired by RFC 3986 Section 6:
 * 1. Parse URL (WHATWG URL parser)
 * 2. Lowercase scheme + host (automatic via URL constructor)
 * 3. Remove default ports (:80 for http, :443 for https)
 * 4. Resolve . and .. path segments (automatic via URL constructor)
 * 5. Decode unreserved percent-encoded chars
 * 6. Sort query params
 * 7. Remove fragment
 * 8. Strip www. prefix
 * 9. Trailing slash: root path preserved; other paths preserve as-is
 * 10. IDN to punycode via domainToASCII
 * 11. Preserve original scheme (do NOT rewrite http to https)
 * 12. Reject embedded credentials
 */
import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import { AppError, ErrorCode } from "@ai-learning-hub/types";

export interface NormalizeResult {
  normalizedUrl: string;
  urlHash: string;
}

/**
 * Unreserved characters that should be decoded per RFC 3986:
 * ALPHA (A-Z, a-z), DIGIT (0-9), hyphen (-), period (.), underscore (_), tilde (~)
 */
const UNRESERVED_PATTERN = /%([0-9A-Fa-f]{2})/g;

function isUnreservedChar(charCode: number): boolean {
  // A-Z: 0x41-0x5A, a-z: 0x61-0x7A, 0-9: 0x30-0x39
  // hyphen: 0x2D, period: 0x2E, underscore: 0x5F, tilde: 0x7E
  return (
    (charCode >= 0x41 && charCode <= 0x5a) || // A-Z
    (charCode >= 0x61 && charCode <= 0x7a) || // a-z
    (charCode >= 0x30 && charCode <= 0x39) || // 0-9
    charCode === 0x2d || // -
    charCode === 0x2e || // .
    charCode === 0x5f || // _
    charCode === 0x7e // ~
  );
}

function decodeUnreserved(str: string): string {
  return str.replace(UNRESERVED_PATTERN, (_match, hex) => {
    const charCode = parseInt(hex, 16);
    if (isUnreservedChar(charCode)) {
      return String.fromCharCode(charCode);
    }
    // Re-encode with uppercase hex for consistency
    return `%${hex.toUpperCase()}`;
  });
}

export function normalizeUrl(rawUrl: string): NormalizeResult {
  // Validate input
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new NormalizeError("A valid URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new NormalizeError("A valid URL is required");
  }

  // Reject non-http(s) schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new NormalizeError("Only http and https URLs are supported");
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    throw new NormalizeError("URLs with embedded credentials are not allowed");
  }

  // Default port removal: The WHATWG URL constructor automatically strips
  // default ports (80 for http, 443 for https), so no explicit handling needed.

  // Sort query params
  // Note: URLSearchParams.toString() re-serializes spaces as + (application/x-www-form-urlencoded)
  parsed.searchParams.sort();

  // Remove fragment
  parsed.hash = "";

  // Get hostname, strip www. prefix, convert IDN to punycode
  let hostname = parsed.hostname.replace(/^www\./, "");
  const punycoded = domainToASCII(hostname);
  if (punycoded) {
    hostname = punycoded;
  }

  // Build the normalized URL
  const protocol = parsed.protocol; // already lowercase from URL constructor
  const port = parsed.port ? `:${parsed.port}` : "";
  let pathname = parsed.pathname;

  // Root path: ensure trailing slash
  if (pathname === "" || pathname === "/") {
    pathname = "/";
  }
  // Non-root paths: preserve as-is (URL constructor already resolves . and ..)

  // Decode unreserved chars in pathname
  pathname = decodeUnreserved(pathname);

  // Build search string and decode unreserved chars
  let search = parsed.search;
  if (search) {
    search = decodeUnreserved(search);
  }

  const normalizedUrl = `${protocol}//${hostname}${port}${pathname}${search}`;

  // Generate SHA-256 hash
  const urlHash = createHash("sha256").update(normalizedUrl).digest("hex");

  return { normalizedUrl, urlHash };
}

export class NormalizeError extends AppError {
  constructor(message: string) {
    super(ErrorCode.VALIDATION_ERROR, message);
    this.name = "NormalizeError";
  }
}
