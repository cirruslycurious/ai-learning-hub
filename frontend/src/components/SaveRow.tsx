import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, FolderPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Resource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getContentTypeIcon } from "@/lib/content-type-icons";

const TUTORIAL_INDICATOR: Record<string, { label: string; className: string }> =
  {
    saved: { label: "Saved", className: "bg-muted text-muted-foreground" },
    started: { label: "In Progress", className: "bg-accent-soft text-primary" },
    "in-progress": {
      label: "In Progress",
      className: "bg-accent-soft text-primary",
    },
    completed: { label: "Completed", className: "bg-brand-soft text-brand" },
  };

interface SaveRowProps {
  resource: Resource;
  compact?: boolean;
  onSelect?: (resource: Resource) => void;
  isLoading?: boolean;
}

export function SaveRow({
  resource,
  compact,
  onSelect,
  isLoading,
}: SaveRowProps) {
  const [hovered, setHovered] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
        <Skeleton className="w-5 h-5 rounded" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }

  const Icon = getContentTypeIcon(resource.contentType);
  const timeAgo = formatDistanceToNowStrict(new Date(resource.createdAt), {
    addSuffix: false,
  });

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-3.5 border-b border-border cursor-pointer transition-all duration-150",
        hovered ? "bg-accent-soft" : "bg-transparent"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect?.(resource)}
    >
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded shrink-0 transition-colors",
          hovered ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate leading-tight">
            {resource.title}
          </span>
        </div>
        {!compact && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {resource.domain}
            </span>
            {resource.tutorialStatus &&
              TUTORIAL_INDICATOR[resource.tutorialStatus] && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    TUTORIAL_INDICATOR[resource.tutorialStatus].className
                  )}
                >
                  {TUTORIAL_INDICATOR[resource.tutorialStatus].label}
                </span>
              )}
          </div>
        )}
      </div>

      {!compact && (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {resource.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="tag" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
        {timeAgo}
      </span>

      {/* Hover quick actions */}
      <div
        className={cn(
          "flex items-center gap-0.5 shrink-0 transition-opacity duration-150",
          hovered ? "opacity-100" : "opacity-0"
        )}
      >
        <button
          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            window.open(resource.url, "_blank");
          }}
          title="Open URL"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="Add to project"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
