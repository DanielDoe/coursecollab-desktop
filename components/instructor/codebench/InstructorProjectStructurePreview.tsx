"use client"

import { FileCode2, Folder } from "lucide-react"
import { childrenOf, filePath, type IdeNode, type IdeProject } from "@/lib/codebench-ide-workspace"
import { cn } from "@/lib/utils"

function PreviewNode({
  node,
  project,
  depth,
  expanded,
}: {
  node: IdeNode
  project: IdeProject
  depth: number
  expanded: Set<string>
}) {
  const kids = node.kind === "folder" ? childrenOf(project, node.id) : []
  const open = expanded.has(node.id)

  return (
    <li className="instructor-tree-item">
      <div
        className="flex items-center gap-2 py-0.5 text-[13px] text-[var(--cc-text-muted)]"
        style={{ paddingLeft: depth * 12 }}
      >
        {node.kind === "folder" ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--cc-warning,#f59e0b)]" />
        ) : (
          <FileCode2 className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {node.kind === "folder" && open && kids.length > 0 ? (
        <ul className="instructor-tree-nested">
          {kids.map((child) => (
            <PreviewNode key={child.id} node={child} project={project} depth={depth + 1} expanded={expanded} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

type Props = {
  project: IdeProject
  className?: string
}

export function InstructorProjectStructurePreview({ project, className }: Props) {
  const roots = childrenOf(project, null)
  const expanded = new Set(project.nodes.filter((node) => node.kind === "folder").map((node) => node.id))

  return (
    <div className={cn("instructor-structure-wrap relative inline-block w-full", className)}>
      <div
        className={cn(
          "instructor-structure-trigger flex cursor-default items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-sm",
        )}
      >
        <svg width="22" height="18" viewBox="0 0 18 14" fill="none" aria-hidden className="shrink-0">
          <path
            d="M16.2 1.75H8.1L6.3 0H1.8C0.81 0 0 0.7875 0 1.75V12.25C0 13.2125 0.81 14 1.8 14H15.165L18 9.1875V3.5C18 2.5375 17.19 1.75 16.2 1.75Z"
            fill="var(--cc-warning,#FFA000)"
          />
          <path
            d="M16.2 2H1.8C0.81 2 0 2.77143 0 3.71429V12.2857C0 13.2286 0.81 14 1.8 14H16.2C17.19 14 18 13.2286 18 12.2857V3.71429C18 2.77143 17.19 2 16.2 2Z"
            fill="color-mix(in srgb, var(--cc-warning,#FFCA28) 90%, white)"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--cc-text)]">Project Structure</p>
          <p className="truncate text-[11px] text-[var(--cc-text-muted)]">{project.name}</p>
        </div>
      </div>

      <div
        className={cn(
          "instructor-structure-panel absolute left-0 top-[calc(100%+8px)] z-20 w-[min(18rem,100%)] max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl",
        )}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          {project.name}
        </p>
        {roots.length === 0 ? (
          <p className="text-xs text-[var(--cc-text-muted)]">No files yet.</p>
        ) : (
          <ul className="instructor-tree-root max-h-56 overflow-y-auto">
            {roots.map((node) => (
              <PreviewNode key={node.id} node={node} project={project} depth={0} expanded={expanded} />
            ))}
          </ul>
        )}
        <p className="mt-3 truncate text-[10px] text-[var(--cc-text-muted)]">
          {project.nodes.filter((n) => n.kind === "file").length} files total
          {roots[0] ? ` · ${filePath(project, roots[0].id)}` : ""}
        </p>
      </div>
    </div>
  )
}
