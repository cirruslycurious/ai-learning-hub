import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { Plus, FolderKanban } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

export default function Projects() {
  const { projects, addProject } = useApp();
  const navigate = useNavigate();
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addProject(name);
    setNewName("");
    setShowNewInput(false);
    navigate(`/projects/${id}`);
  };

  if (projects.length === 0 && !showNewInput) {
    return <EmptyState variant="projects" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-sm font-medium text-foreground">Projects</h1>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowNewInput(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showNewInput && (
          <div className="px-4 py-3 border-b border-border bg-background-alt">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setShowNewInput(false);
                  setNewName("");
                }
              }}
              placeholder="Project name..."
              className="h-8 text-sm"
              autoFocus
            />
          </div>
        )}

        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="flex items-center gap-3 px-4 py-3 border-b border-border cursor-pointer hover:bg-background-alt transition-colors duration-150"
          >
            <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {project.name}
                </span>
                <Badge
                  variant={
                    project.status as
                      | "exploring"
                      | "building"
                      | "paused"
                      | "completed"
                  }
                  className="text-[10px] px-1.5 py-0"
                >
                  {project.status}
                </Badge>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {project.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
              <span>{project.linkedResourceIds.length} saves</span>
              <span>
                {formatDistanceToNowStrict(new Date(project.updatedAt), {
                  addSuffix: false,
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
