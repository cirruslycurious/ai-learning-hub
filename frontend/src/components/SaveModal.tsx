import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { useCreateSave } from "@/api/saves";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SaveModal() {
  const { saveModalOpen, setSaveModalOpen } = useApp();
  const createSave = useCreateSave();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saveModalOpen) {
      setUrl("");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [saveModalOpen]);

  const isValidUrl = (str: string) => {
    try {
      const u = new URL(str.startsWith("http") ? str : `https://${str}`);
      return u.hostname.includes(".");
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setError("That doesn't look like a URL");
      return;
    }
    const finalUrl = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;

    createSave.mutate(
      { url: finalUrl },
      {
        onSuccess: () => {
          setSaveModalOpen(false);
          toast("Saved.", {
            icon: <Check className="w-4 h-4 text-primary" />,
            className: "quetzal-glow",
            duration: 4000,
          });
        },
        onError: (err) => {
          setError(err.message || "Failed to save");
        },
      }
    );
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text");
    if (isValidUrl(pasted)) {
      setTimeout(() => handleSave(), 500);
    }
  };

  return (
    <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Save a resource
          </DialogTitle>
          <DialogDescription className="sr-only">
            Paste or type a URL to save
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              ref={inputRef}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              onPaste={handlePaste}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Paste or type a URL"
              className={cn(
                "h-10",
                error ? "border-destructive focus-visible:ring-destructive" : ""
              )}
              disabled={createSave.isPending}
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!url.trim() || createSave.isPending}
            >
              {createSave.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
