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
 * Save entity (from saves table)
 */
export interface Save extends BaseEntity {
  userId: string;
  saveId: string;
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  resourceType?: ResourceType;
  notes?: string;
  tutorialStatus?: TutorialStatus;
}

/**
 * Resource types for saved URLs
 */
export enum ResourceType {
  ARTICLE = "ARTICLE",
  VIDEO = "VIDEO",
  PODCAST = "PODCAST",
  TUTORIAL = "TUTORIAL",
  DOCUMENTATION = "DOCUMENTATION",
  REPOSITORY = "REPOSITORY",
  OTHER = "OTHER",
}

/**
 * Tutorial progress status
 */
export enum TutorialStatus {
  SAVED = "SAVED",
  STARTED = "STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
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
  createdBy: string;
  usedBy?: string;
  usedAt?: string;
  createdAt: string;
  expiresAt?: string;
}
