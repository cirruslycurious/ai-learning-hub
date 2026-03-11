import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Link2, Pencil } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { Project } from "@/lib/types";

export default function ProjectWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, updateProjectStatus, updateProjectNotes } = useApp();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [activeTab, setActiveTab] = useState<"resources" | "notes">(
    "resources"
  );

  const project = projects.find((p) => p.id === id);
  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const ResourcesPane = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Linked Resources
        </span>
      </div>
      <div className="px-4 py-2.5 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-primary h-7 px-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Link Save
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <p className="text-sm text-muted-foreground mb-3">
            No resources linked yet.
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link2 className="w-3.5 h-3.5" />
            Link a save
          </Button>
        </div>
      </div>
    </div>
  );

  const NotesPane = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {isEditingNotes ? "Editing" : "Preview mode"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1.5 text-muted-foreground"
          onClick={() => setIsEditingNotes(!isEditingNotes)}
        >
          <Pencil className="w-3 h-3" />
          {isEditingNotes ? "Preview" : "Edit"}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {isEditingNotes ? (
          <textarea
            className="w-full h-full min-h-[400px] bg-transparent text-sm font-mono resize-none focus:outline-none text-foreground leading-relaxed"
            value={project.notes}
            onChange={(e) => updateProjectNotes(project.id, e.target.value)}
            autoFocus
          />
        ) : project.notes ? (
          <div
            className="prose-workspace cursor-pointer"
            onClick={() => setIsEditingNotes(true)}
          >
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-xl font-semibold text-foreground mb-3 mt-6 first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-foreground mb-2 mt-5">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-foreground mb-1.5 mt-4">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-foreground leading-relaxed mb-3">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">
                    {children}
                  </strong>
                ),
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => (
                  <ul className="list-disc list-outside ml-5 mb-3 space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside ml-5 mb-3 space-y-1">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-foreground leading-relaxed">
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/40 pl-4 py-2 my-3 bg-muted/30 rounded-r-md italic text-sm text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="bg-background-alt rounded-md p-4 my-3 overflow-x-auto">
                        <code className="text-xs font-mono text-foreground">
                          {children}
                        </code>
                      </pre>
                    );
                  }
                  return (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                input: ({ checked, ...props }) => (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="rounded accent-primary mr-2 mt-0.5"
                    {...props}
                  />
                ),
              }}
            >
              {project.notes}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Start capturing your thinking here.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setIsEditingNotes(true)}
            >
              Start writing
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate("/projects")}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Projects
          </button>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>
          <Select
            value={project.status}
            onValueChange={(val) =>
              updateProjectStatus(project.id, val as Project["status"])
            }
          >
            <SelectTrigger className="w-auto h-7 gap-1.5 border-0 px-2">
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
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exploring">Exploring</SelectItem>
              <SelectItem value="building">Building</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {project.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {project.description}
          </p>
        )}
        {project.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2.5">
            {project.tags.map((tag) => (
              <Badge key={tag} variant="tag" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden flex border-b border-border">
        <button
          className={cn(
            "flex-1 py-2.5 text-xs font-medium text-center transition-colors",
            activeTab === "resources"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground"
          )}
          onClick={() => setActiveTab("resources")}
        >
          Resources
        </button>
        <button
          className={cn(
            "flex-1 py-2.5 text-xs font-medium text-center transition-colors",
            activeTab === "notes"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground"
          )}
          onClick={() => setActiveTab("notes")}
        >
          Notes
        </button>
      </div>

      {/* Desktop: split pane */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-2/5 border-r border-border overflow-hidden">
          <ResourcesPane />
        </div>
        <div className="flex-1 overflow-hidden">
          <NotesPane />
        </div>
      </div>

      {/* Mobile: tab content */}
      <div className="lg:hidden flex-1 overflow-hidden">
        {activeTab === "resources" ? <ResourcesPane /> : <NotesPane />}
      </div>
    </div>
  );
}
