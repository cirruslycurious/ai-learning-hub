import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

const THEME_CYCLE = { system: "light", light: "dark", dark: "system" } as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const currentTheme = (theme ?? "system") as keyof typeof THEME_CYCLE;
  const nextTheme = THEME_CYCLE[currentTheme] ?? "system";

  const Icon =
    currentTheme === "dark" ? Moon : currentTheme === "light" ? Sun : Monitor;

  return (
    <button
      onClick={() => setTheme(nextTheme)}
      className="flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
      aria-label="Toggle theme"
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}
