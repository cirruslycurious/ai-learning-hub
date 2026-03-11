/**
 * Library page — lists all saved resources.
 *
 * Fetches from GET /saves via React Query. Supports filtering by
 * content type and search text.
 */
import { useState } from "react";
import { useSaves, type ListSavesParams } from "@/api/saves";
import { SaveRow } from "@/components/SaveRow";
import { EmptyState } from "@/components/EmptyState";
import { DetailPanel } from "@/components/DetailPanel";
import type { Resource } from "@/lib/types";
import type { ContentType } from "@ai-learning-hub/types";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Library() {
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const params: ListSavesParams = {
    ...(typeFilter !== "all" && { contentType: typeFilter as ContentType }),
    ...(searchQuery && { search: searchQuery }),
  };

  const { data, isLoading, isError, error } = useSaves(params);
  const resources = data?.resources ?? [];

  // Show empty state when no saves exist (or API unreachable) and no filters active
  if (
    !isLoading &&
    resources.length === 0 &&
    !searchQuery &&
    typeFilter === "all"
  ) {
    return <EmptyState variant="library" />;
  }

  // Show empty state on network error before user has interacted with filters
  if (isError && !searchQuery && typeFilter === "all") {
    return <EmptyState variant="library" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          Library
        </h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {isLoading
            ? "..."
            : `${resources.length} ${resources.length === 1 ? "save" : "saves"}`}
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter saves..."
            className="pl-8 h-8 text-sm bg-transparent"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="article">Articles</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="github_repo">Repos</SelectItem>
            <SelectItem value="podcast">Podcasts</SelectItem>
            <SelectItem value="course">Courses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resource list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm text-destructive mb-1">
              Failed to load saves
            </p>
            <p className="text-xs text-muted-foreground">{error?.message}</p>
          </div>
        ) : resources.length === 0 ? (
          <EmptyState variant="search" />
        ) : (
          resources.map((resource) => (
            <SaveRow
              key={resource.id}
              resource={resource}
              onSelect={setSelectedResource}
            />
          ))
        )}
      </div>

      {/* Detail panel */}
      <DetailPanel
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
      />
    </div>
  );
}
