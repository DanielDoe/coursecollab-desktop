"use client"

import { ChevronRight, Clock3, FileCode2, History } from "lucide-react"
import { InstructorAnimatedFolder } from "@/components/instructor/codebench/InstructorAnimatedFolder"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { IdeProject } from "@/lib/codebench-ide-workspace"
import { filePath } from "@/lib/codebench-ide-workspace"
import type { InstructorProjectSnapshot } from "@/lib/codebench-instructor-version-history"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  project: IdeProject
  snapshots: InstructorProjectSnapshot[]
  isActive: boolean
  cardClass?: string
  onOpen: () => void
}

function formatUpdatedAt(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InstructorProjectCard({ project, snapshots, isActive, cardClass, onOpen }: Props) {
  const files = project.nodes.filter((node) => node.kind === "file")

  return (
    <article
      className={cn(
        cardClass,
        "instructor-project-card instructor-lift-card group relative flex min-w-0 flex-col overflow-hidden",
        isActive && "instructor-project-card--active",
      )}
    >
      <div className="instructor-project-card__body flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="instructor-project-card__hero flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <InstructorAnimatedFolder
            title={project.name}
            fileCount={files.length}
            selected={isActive}
            onClick={onOpen}
            className="instructor-folder--card instructor-project-card__folder mx-auto shrink-0 sm:mx-0"
          />

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={cn("truncate text-base font-semibold tracking-tight sm:text-lg", PORTAL_TEXT)}>
                    {project.name}
                  </h3>
                  {isActive ? (
                    <Badge className="border-0 bg-[color-mix(in_srgb,var(--cc-accent)_18%,var(--card))] text-[10px] text-[var(--cc-accent)] hover:bg-[color-mix(in_srgb,var(--cc-accent)_18%,var(--card))]">
                      Active
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {files.length} file{files.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    <Clock3 className="mr-1 h-3 w-3" />
                    {formatUpdatedAt(project.updatedAt)}
                  </Badge>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full shrink-0 sm:w-auto"
                onClick={onOpen}
              >
                Open in IDE
                <ChevronRight className="ml-0.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>

            {files.length > 0 ? (
              <ul className="instructor-project-card__files flex min-w-0 flex-wrap gap-1.5">
                {files.slice(0, 8).map((file) => (
                  <li key={file.id}>
                    <span className="instructor-project-card__file-chip inline-flex max-w-full items-center gap-1.5">
                      <FileCode2 className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="truncate font-mono text-[11px]">{filePath(project, file.id)}</span>
                    </span>
                  </li>
                ))}
                {files.length > 8 ? (
                  <li>
                    <span className="instructor-project-card__file-chip text-[11px] text-[var(--cc-text-muted)]">
                      +{files.length - 8} more
                    </span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>No files yet — open the IDE to add starter code.</p>
            )}
          </div>
        </div>

        <div className="instructor-project-card__history min-w-0">
          <div className="mb-2 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT)}>Version history</p>
          </div>
          {snapshots.length === 0 ? (
            <p className={cn("rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs", PORTAL_TEXT_MUTED)}>
              Save in the IDE to record snapshots.
            </p>
          ) : (
            <ul className="instructor-project-card__timeline space-y-0">
              {snapshots.slice(0, 4).map((snap, index) => (
                <li key={snap.id} className="instructor-project-card__timeline-item flex min-w-0 gap-2.5 py-1.5">
                  <span
                    className={cn(
                      "instructor-project-card__timeline-dot mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      index === 0 ? "bg-[var(--cc-accent)]" : "bg-[var(--border)]",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-xs font-medium", PORTAL_TEXT)}>{snap.label}</p>
                    <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>
                      {new Date(snap.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  )
}
