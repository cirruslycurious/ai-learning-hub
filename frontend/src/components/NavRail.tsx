import { useLocation, useNavigate } from "react-router-dom";
import {
  BookmarkPlus,
  Search,
  Library,
  FolderKanban,
  BookOpen,
  Settings,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import quetzalLogo from "@/assets/quetzal-logo.png";

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  path: string | null;
  action?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "save", icon: BookmarkPlus, label: "Save", path: null, action: "save" },
  { id: "search", icon: Search, label: "Search", path: "/search" },
  { id: "library", icon: Library, label: "Library", path: "/app" },
  { id: "projects", icon: FolderKanban, label: "Projects", path: "/projects" },
  { id: "guides", icon: BookOpen, label: "Guides", path: "/guides" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "settings", icon: Settings, label: "Settings", path: "/settings" },
];

export function NavRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSaveModalOpen } = useApp();

  const handleClick = (item: NavItem) => {
    if (item.action === "save") {
      setSaveModalOpen(true);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const isActive = (path: string | null | undefined) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Desktop rail */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-14 flex-col items-center py-4 border-r border-border bg-sidebar z-40">
        <img
          src={quetzalLogo}
          alt="AI Learning Hub"
          className="w-9 h-9 object-contain mb-3"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="flex flex-col items-center gap-1.5 flex-1">
          {NAV_ITEMS.map((item) => (
            <Tooltip key={item.id} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleClick(item)}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-md transition-all duration-150",
                    item.action === "save"
                      ? "text-primary hover:bg-accent-soft"
                      : isActive(item.path)
                        ? "bg-accent-soft text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {isActive(item.path) && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-primary" />
                  )}
                  <item.icon className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {BOTTOM_ITEMS.map((item) => (
            <Tooltip key={item.id} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => item.path && navigate(item.path)}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-md transition-all duration-150",
                    isActive(item.path)
                      ? "bg-accent-soft text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {isActive(item.path) && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-primary" />
                  )}
                  <item.icon className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 flex items-center justify-around border-t border-border bg-background z-40">
        {NAV_ITEMS.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors",
              item.action === "save"
                ? "text-primary"
                : isActive(item.path)
                  ? "text-primary"
                  : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span
              className={cn(
                "text-[10px]",
                isActive(item.path) ? "font-semibold" : "font-medium"
              )}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
}
