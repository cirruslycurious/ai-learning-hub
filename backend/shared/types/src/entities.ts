/**
 * Entity type stubs for AI Learning Hub domain objects
 * These will be expanded as entities are implemented in later stories
 */

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  createdAt: string;
  updatedAt: string;
}

/**
 * User entity (from users table)
 */
export interface User extends BaseEntity {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  roles: string[];
}

/**
 * Save entity (from saves table) — Epic 3 full schema
 */
export interface Save extends BaseEntity {
  userId: string;
  saveId: string; // ULID
  url: string; // Original URL as submitted
  normalizedUrl: string; // Canonical form after normalization
  urlHash: string; // SHA-256 of normalizedUrl
  title?: string; // Max 500 chars
  userNotes?: string; // Max 2000 chars
  contentType: ContentType; // Defaults to 'other'
  tags: string[]; // Max 20 tags, each max 50 chars
  isTutorial: boolean; // Default false
  tutorialStatus?: TutorialStatus | null;
  linkedProjectCount: number; // Default 0
  lastAccessedAt?: string; // Updated on GET /saves/:id
  enrichedAt?: string; // Set by Epic 9 enrichment
  deletedAt?: string; // Soft delete marker
}

/**
 * Content types for saved URLs (Epic 3)
 */
export enum ContentType {
  ARTICLE = "article",
  VIDEO = "video",
  PODCAST = "podcast",
  GITHUB_REPO = "github_repo",
  NEWSLETTER = "newsletter",
  TOOL = "tool",
  REDDIT = "reddit",
  LINKEDIN = "linkedin",
  OTHER = "other",
}

/**
 * Tutorial progress status (lowercase, per PRD FR40)
 */
export enum TutorialStatus {
  SAVED = "saved",
  STARTED = "started",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
}

/**
 * Project entity (from projects table)
 */
export interface Project extends BaseEntity {
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  folderId?: string;
  tags: string[];
}

/**
 * Project status values
 */
export enum ProjectStatus {
  EXPLORING = "EXPLORING",
  BUILDING = "BUILDING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
}

/**
 * Folder entity (from projects table)
 */
export interface Folder extends BaseEntity {
  userId: string;
  folderId: string;
  name: string;
  parentFolderId?: string;
}

/**
 * Link entity (from links table) - save-project relationship
 */
export interface Link extends BaseEntity {
  userId: string;
  linkId: string;
  saveId: string;
  projectId: string;
}

/**
 * Content entity (from content table) - global URL metadata
 */
export interface Content {
  urlHash: string;
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  enrichedAt?: string;
  enrichmentStatus: EnrichmentStatus;
}

/**
 * URL enrichment status
 */
export enum EnrichmentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/**
 * API Key entity (stored with user)
 */
export interface ApiKey extends BaseEntity {
  userId: string;
  keyId: string;
  name: string;
  keyHash: string; // One-way hash, not the actual key
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
}

/**
 * Invite code entity (from invite-codes table)
 */
export interface InviteCode {
  code: string;
  generatedBy: string;
  redeemedBy?: string;
  redeemedAt?: string;
  generatedAt: string;
  expiresAt?: string;
}
