/**
 * App-level state provider.
 *
 * Manages:
 * - UI state (modals, selections)
 * - Local project data (backend projects API not yet implemented)
 *
 * Save data is handled by React Query hooks in api/saves.ts —
 * this store does NOT duplicate that.
 */
import React, { createContext, useContext, useState, useCallback } from "react";
import type { Project } from "./types";
import { MOCK_PROJECTS } from "./mock-data";

interface AppState {
  // Projects (local until backend supports them)
  projects: Project[];
  addProject: (name: string) => string;
  updateProjectStatus: (projectId: string, status: Project["status"]) => void;
  updateProjectNotes: (projectId: string, notes: string) => void;

  // UI state
  saveModalOpen: boolean;
  setSaveModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const addProject = useCallback((name: string) => {
    const id = crypto.randomUUID();
    const newProject: Project = {
      id,
      name,
      description: "",
      status: "exploring",
      tags: [],
      linkedResourceIds: [],
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects((prev) => [newProject, ...prev]);
    return id;
  }, []);

  const updateProjectStatus = useCallback(
    (projectId: string, status: Project["status"]) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, status, updatedAt: new Date().toISOString() }
            : p
        )
      );
    },
    []
  );

  const updateProjectNotes = useCallback((projectId: string, notes: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, notes, updatedAt: new Date().toISOString() }
          : p
      )
    );
  }, []);

  return (
    <AppContext.Provider
      value={{
        projects,
        addProject,
        updateProjectStatus,
        updateProjectNotes,
        saveModalOpen,
        setSaveModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
