"use client"

import { LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

type FacultyViewOrganizerProps = {
  moduleId: string
  viewMode: "grid" | "list"
  onViewModeChange: (mode: "grid" | "list") => void
  className?: string
}

export function FacultyViewOrganizer({
  moduleId,
  viewMode,
  onViewModeChange,
  className,
}: FacultyViewOrganizerProps) {
  const chrome = facultyEmbedChrome(moduleId)

  return (
    <div className={cn(chrome.viewOrganizer.container, className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange("grid")}
        className={cn(
          "h-8 w-8",
          viewMode === "grid" ? chrome.viewOrganizer.active : chrome.viewOrganizer.inactive,
        )}
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onViewModeChange("list")}
        className={cn(
          "h-8 w-8",
          viewMode === "list" ? chrome.viewOrganizer.active : chrome.viewOrganizer.inactive,
        )}
        aria-label="List view"
        aria-pressed={viewMode === "list"}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  )
}
