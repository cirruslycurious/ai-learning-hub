/**
 * Frontend UI types.
 *
 * Maps backend entity types to the shapes used by UI components.
 * The backend Save entity is the source of truth — these types
 * provide UI-friendly aliases and add derived fields (e.g. domain).
 */

export type {
  ContentType,
  TutorialStatus,
  ProjectStatus,
} from "@ai-learning-hub/types";

import type { ContentType, TutorialStatus } from "@ai-learning-hub/types";

/**
 * UI representation of a saved resource.
 * Derived from the backend PublicSave entity with a computed `domain` field.
 */
export interface Resource {
  id: string;
  url: string;
  title: string;
  domain: string;
  contentType: ContentType;
  tags: string[];
  enrichedAt?: string;
  isTutorial: boolean;
  tutorialStatus?: TutorialStatus | null;
  linkedProjectCount: number;
  version: number;
  userNotes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Local-only project type (backend projects API is not yet implemented).
 * Will be replaced with backend types when Epic 4+ ships.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  status: "exploring" | "building" | "paused" | "completed";
  tags: string[];
  linkedResourceIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}
