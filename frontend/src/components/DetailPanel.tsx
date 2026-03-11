import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Resource } from "@/lib/types";
import { ExternalLink, FolderPlus, Tag } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

interface DetailPanelProps {
  resource: Resource | null;
  onClose: () => void;
}

export function DetailPanel({ resource, onClose }: DetailPanelProps) {
  if (!resource) return null;

  const timeAgo = formatDistanceToNowStrict(new Date(resource.createdAt), {
    addSuffix: true,
  });

  return (
    <Sheet open={!!resource} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base font-medium leading-snug pr-6">
            {resource.title}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Resource details
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{resource.domain}</span>
            <span>&middot;</span>
            <span>{resource.contentType}</span>
            <span>&middot;</span>
            <span>{timeAgo}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              asChild
            >
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FolderPlus className="w-3.5 h-3.5" />
              Link to project
            </Button>
          </div>

          {/* Tags */}
          {resource.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Tag className="w-3.5 h-3.5" />
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {resource.tags.map((tag) => (
                  <Badge key={tag} variant="tag">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {resource.userNotes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Note</p>
              <p className="text-sm text-foreground bg-background-alt rounded-md p-3">
                {resource.userNotes}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
