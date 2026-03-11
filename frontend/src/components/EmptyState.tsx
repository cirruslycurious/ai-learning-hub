import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";

interface EmptyStateProps {
  variant: "library" | "projects" | "search";
}

export function EmptyState({ variant }: EmptyStateProps) {
  const { setSaveModalOpen } = useApp();

  if (variant === "library") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-lg font-medium text-foreground mb-1">
          Save anything you&apos;re learning.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          We&apos;ll take it from here.
        </p>
        <Button onClick={() => setSaveModalOpen(true)} className="gap-2">
          <BookmarkPlus className="w-4 h-4" />
          Save your first URL
        </Button>
        <div className="mt-12 w-full max-w-sm">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
            Starter projects to explore
          </p>
          <div className="space-y-2">
            {[
              "Build a Custom GPT",
              "AI Automation for Your Day Job",
              "Build a RAG Pipeline",
            ].map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-alt text-sm text-foreground"
              >
                <span className="text-muted-foreground">&mdash;</span>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "projects") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-lg font-medium text-foreground mb-1">
          Projects connect your saves to what you&apos;re building.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Your saves are the raw material. Projects are where they become
          something.
        </p>
        <Button className="gap-2">Create your first project</Button>
      </div>
    );
  }

  // search
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Nothing matches that. Try different keywords?
      </p>
    </div>
  );
}
