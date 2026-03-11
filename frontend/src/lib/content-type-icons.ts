import {
  Video,
  Podcast,
  FileText,
  Github,
  Mail,
  Wrench,
  MessageSquare,
  Linkedin,
  GraduationCap,
  BookOpen,
  Link2,
} from "lucide-react";

export const CONTENT_TYPE_ICONS = {
  video: Video,
  podcast: Podcast,
  article: FileText,
  github_repo: Github,
  repository: Github,
  newsletter: Mail,
  tool: Wrench,
  reddit: MessageSquare,
  linkedin: Linkedin,
  course: GraduationCap,
  documentation: BookOpen,
  other: Link2,
} as const;

export type ContentType = keyof typeof CONTENT_TYPE_ICONS;

/** Returns the Lucide icon component for the given content type, falling back to Link2 for unknown types. */
export function getContentTypeIcon(type: string): React.ElementType {
  return CONTENT_TYPE_ICONS[type as ContentType] ?? CONTENT_TYPE_ICONS.other;
}
