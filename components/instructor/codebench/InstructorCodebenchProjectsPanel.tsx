"use client"

import { useMemo } from "react"
import { FolderKanban } from "lucide-react"
import { InstructorProjectCard } from "@/components/instructor/codebench/InstructorProjectCard"
import { Button } from "@/components/ui/button"
import { useCodebenchIde } from "@/hooks/use-codebench-ide"
import { instructorCodebenchOwnerKey } from "@/lib/codebench-instructor-scope"
import { listProjectSnapshots } from "@/lib/codebench-instructor-version-history"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  onOpenWorkspace?: () => void
}

export function InstructorCodebenchProjectsPanel({ onOpenWorkspace }: Props) {
  const ownerKey = useMemo(() => instructorCodebenchOwnerKey(), [])
  const ide = useCodebenchIde({ studentId: ownerKey })
  const chrome = facultyEmbedChrome("codebench")

  return (
    <div className="instructor-projects-panel flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
      <div className={cn(chrome.card, "space-y-2 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <FolderKanban className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
          <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Projects</h2>
        </div>
        <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
          Instructor coding projects with file trees and local version snapshots — not one giant database blob.
        </p>
        {onOpenWorkspace ? (
          <Button type="button" size="sm" className="w-full sm:w-auto" onClick={onOpenWorkspace}>
            Open My Workspace
          </Button>
        ) : null}
      </div>

      <div className="instructor-projects-grid grid grid-cols-1 gap-4">
        {ide.projects.map((project) => {
          const snapshots = listProjectSnapshots(project.id, ownerKey)
          const isActive = ide.project.id === project.id
          const openProject = () => {
            ide.switchProject(project.id)
            onOpenWorkspace?.()
          }
          return (
            <InstructorProjectCard
              key={project.id}
              project={project}
              snapshots={snapshots}
              isActive={isActive}
              cardClass={chrome.card}
              onOpen={openProject}
            />
          )
        })}
      </div>
    </div>
  )
}
