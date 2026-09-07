"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { childrenOf, filePath, isFileDirty, type IdeNode, type IdeProject } from "@/lib/codebench-ide-workspace"
import { cn } from "@/lib/utils"

type Props = {
  project: IdeProject
  projects: IdeProject[]
  activeFileId: string | null
  onSwitchProject: (projectId: string) => void
  onCreateProject: (name: string) => void
  onRenameProject: (name: string) => void
  onOpenFile: (fileId: string) => void
  onCreateFile: (parentId?: string | null, name?: string) => void
  onCreateFolder: (name: string, parentId?: string | null) => void
  onRenameNode: (nodeId: string, name: string) => void
  onDeleteNode: (nodeId: string) => void
  localRoot?: string | null
  onRevealLocalFolder?: () => void
  onChooseLocalFolder?: () => void
}

type NameDialog =
  | { kind: "file"; parentId: string | null }
  | { kind: "folder"; parentId: string | null }
  | { kind: "rename"; node: IdeNode }
  | { kind: "project" }
  | { kind: "rename-project" }

type DeleteTarget = {
  id: string
  kind: "file" | "folder"
  path: string
  files: number
  folders: number
}

function descendantSummary(project: IdeProject, nodeId: string) {
  let files = 0
  let folders = 0
  const visit = (id: string) => {
    for (const child of project.nodes.filter((node) => node.parentId === id)) {
      if (child.kind === "file") files += 1
      else folders += 1
      visit(child.id)
    }
  }
  visit(nodeId)
  return { files, folders }
}

function TreeRow({
  node,
  project,
  depth,
  activeFileId,
  expanded,
  onToggle,
  onOpenFile,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: {
  node: IdeNode
  project: IdeProject
  depth: number
  activeFileId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
  onOpenFile: (fileId: string) => void
  onNewFile: (parentId: string) => void
  onNewFolder: (parentId: string) => void
  onRename: (node: IdeNode) => void
  onDelete: (node: IdeNode) => void
}) {
  const { accent } = useCodebenchChrome()
  const childNodes = node.kind === "folder" ? childrenOf(project, node.id) : []
  const isOpen = expanded.has(node.id)
  const active = node.id === activeFileId
  const dirty = isFileDirty(node)

  return (
    <div>
      <div
        className={cn(
          "group flex h-8 items-center gap-1 rounded-md pr-1 text-[12px]",
          active
            ? "bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))] text-[var(--cc-text)]"
            : "text-[var(--cc-text)] hover:bg-[var(--muted)]",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {node.kind === "folder" ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
            onClick={() => onToggle(node.id)}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />}
            <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
            <span className="truncate">{node.name}</span>
          </button>
        ) : (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
            onClick={() => onOpenFile(node.id)}
          >
            <span className="w-3.5 shrink-0" />
            <FileCode className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
            <span className="truncate">{node.name}</span>
            {node.namedByCora ? <Sparkles className="h-3 w-3 shrink-0" style={{ color: accent }} /> : null}
            {dirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--cc-accent)]" /> : null}
          </button>
        )}
        <div className="flex shrink-0 items-center opacity-80 group-hover:opacity-100">
          {node.kind === "folder" ? (
            <>
              <button type="button" className="rounded p-0.5 text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]" title="New file in folder" onClick={(event) => { event.stopPropagation(); onNewFile(node.id) }}>
                <FilePlus className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded p-0.5 text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]" title="New folder inside" onClick={(event) => { event.stopPropagation(); onNewFolder(node.id) }}>
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </>
          ) : null}
          <button type="button" className="rounded p-0.5 text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]" title="Rename" onClick={(event) => { event.stopPropagation(); onRename(node) }}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="rounded p-0.5 text-[var(--cc-text-muted)] hover:bg-[var(--card)] hover:text-[var(--cc-danger)]" title="Delete" onClick={(event) => { event.stopPropagation(); onDelete(node) }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {node.kind === "folder" && isOpen
        ? childNodes.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              project={project}
              depth={depth + 1}
              activeFileId={activeFileId}
              expanded={expanded}
              onToggle={onToggle}
              onOpenFile={onOpenFile}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        : null}
    </div>
  )
}

export function CodebenchExplorer({
  project,
  projects,
  activeFileId,
  onSwitchProject,
  onCreateProject,
  onRenameProject,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameNode,
  onDeleteNode,
  localRoot,
  onRevealLocalFolder,
  onChooseLocalFolder,
}: Props) {
  const { accent } = useCodebenchChrome()
  const roots = useMemo(() => childrenOf(project, null), [project])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(project.nodes.filter((node) => node.kind === "folder").map((node) => node.id)))
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [nameValue, setNameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [explorerLocked, setExplorerLocked] = useState(false)
  const asideRef = useRef<HTMLElement | null>(null)
  const shieldRef = useRef<HTMLDivElement | null>(null)
  const unlockTimer = useRef<number>(0)
  const ignoreOpens = useRef(false)

  const lockExplorer = () => {
    ignoreOpens.current = true
    if (asideRef.current) asideRef.current.style.pointerEvents = "none"
    if (shieldRef.current) shieldRef.current.style.pointerEvents = "auto"
    setExplorerLocked(true)
    window.clearTimeout(unlockTimer.current)
    unlockTimer.current = window.setTimeout(() => {
      ignoreOpens.current = false
      if (asideRef.current) asideRef.current.style.pointerEvents = ""
      if (shieldRef.current) shieldRef.current.style.pointerEvents = ""
      setExplorerLocked(false)
    }, 600)
  }

  const closeNameDialog = () => {
    lockExplorer()
    window.setTimeout(() => {
      setNameDialog(null)
      setNameValue("")
    }, 160)
  }

  const closeDeleteDialog = () => {
    lockExplorer()
    window.setTimeout(() => {
      setDeleteTarget(null)
    }, 160)
  }

  const openDeleteDialog = (node: IdeNode) => {
    if (ignoreOpens.current) return
    const counts = descendantSummary(project, node.id)
    setDeleteTarget({
      id: node.id,
      kind: node.kind,
      path: filePath(project, node.id),
      files: counts.files,
      folders: counts.folders,
    })
  }

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current)
      for (const node of project.nodes) {
        if (node.kind === "folder") next.add(node.id)
      }
      return next
    })
  }, [project.nodes])

  const openNameDialog = (dialog: NameDialog) => {
    if (ignoreOpens.current) return
    const preset =
      dialog.kind === "file"
        ? ""
        : dialog.kind === "folder"
          ? "src"
          : dialog.kind === "rename"
            ? dialog.node.name
            : dialog.kind === "rename-project"
              ? project.name
              : "New Project"
    setNameValue(preset)
    setNameDialog(dialog)
  }

  const submitNameDialog = () => {
    if (!nameDialog || ignoreOpens.current) return
    const value = nameValue.trim()
    if (nameDialog.kind === "file") {
      onCreateFile(nameDialog.parentId, value || undefined)
    } else if (nameDialog.kind === "folder") {
      if (!value) return
      onCreateFolder(value, nameDialog.parentId)
    } else if (nameDialog.kind === "rename") {
      if (!value) return
      onRenameNode(nameDialog.node.id, value)
    } else if (nameDialog.kind === "project") {
      if (!value) return
      onCreateProject(value)
    } else if (nameDialog.kind === "rename-project") {
      if (!value) return
      onRenameProject(value)
    }
    closeNameDialog()
  }

  const nameTitle =
    nameDialog?.kind === "file"
      ? "New file"
      : nameDialog?.kind === "folder"
        ? "New folder"
        : nameDialog?.kind === "rename"
          ? `Rename ${nameDialog.node.kind}`
          : nameDialog?.kind === "project"
            ? "New project"
            : "Rename project"

  const nameHint =
    nameDialog?.kind === "file"
      ? "Leave blank to create an untitled file. Cora will name it after you write code."
      : nameDialog?.kind === "folder"
        ? "Folders keep related files together in this project."
        : nameDialog?.kind === "rename"
          ? nameDialog.node.kind === "file"
            ? "Include an extension such as .cpp or .py."
            : "This updates the folder name in the project tree."
          : nameDialog?.kind === "project"
            ? "Start a separate workspace for another assignment or idea."
            : "This name appears in the project switcher."

  return (
    <>
    <aside
      ref={asideRef}
      tabIndex={-1}
      className={cn(
        "flex h-full min-h-0 w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] outline-none",
        explorerLocked && "pointer-events-none",
      )}
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
        <select
          aria-label="Project"
          className="h-7 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 text-[11px] font-medium text-[var(--cc-text)]"
          value={project.id}
          onChange={(event) => onSwitchProject(event.target.value)}
        >
          {projects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-md p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
          title="Rename project"
          onClick={() => openNameDialog({ kind: "rename-project" })}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Files
        </span>
        <button type="button" className="rounded p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]" title="New file" onClick={() => openNameDialog({ kind: "file", parentId: null })}>
          <FilePlus className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]" title="New folder" onClick={() => openNameDialog({ kind: "folder", parentId: null })}>
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]" title="New project" onClick={() => openNameDialog({ kind: "project" })}>
          <span className="block text-[11px] font-semibold" style={{ color: accent }}>+</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {roots.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-[var(--cc-text-muted)]">No files yet. Create a file or folder to start.</p>
        ) : (
          roots.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              project={project}
              depth={0}
              activeFileId={activeFileId}
              expanded={expanded}
              onToggle={(id) => {
                setExpanded((current) => {
                  const next = new Set(current)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }}
              onOpenFile={onOpenFile}
              onNewFile={(parentId) => openNameDialog({ kind: "file", parentId })}
              onNewFolder={(parentId) => openNameDialog({ kind: "folder", parentId })}
              onRename={(node) => openNameDialog({ kind: "rename", node })}
              onDelete={openDeleteDialog}
            />
          ))
        )}
      </div>
      {localRoot || onChooseLocalFolder ? (
        <div className="shrink-0 border-t border-[var(--border)] px-2 py-2">
          <p className="truncate text-[10px] text-[var(--cc-text-muted)]" title={localRoot ?? undefined}>
            {localRoot ? localRoot : "Save a folder on this computer"}
          </p>
          <div className="mt-1 flex items-center gap-1">
            {onRevealLocalFolder ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
                onClick={onRevealLocalFolder}
              >
                <FolderOpen className="h-3 w-3" />
                Open folder
              </button>
            ) : null}
            {onChooseLocalFolder ? (
              <button
                type="button"
                className="rounded px-1 py-0.5 text-[10px] text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
                onClick={onChooseLocalFolder}
              >
                Choose…
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Dialog open={nameDialog !== null} onOpenChange={(open) => { if (!open && !ignoreOpens.current) closeNameDialog() }}>
        <DialogContent
          className="z-[80] max-w-sm"
          showCloseButton
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            asideRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>{nameTitle}</DialogTitle>
            <DialogDescription>{nameHint}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submitNameDialog()
            }}
          >
            <Input
              autoFocus
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              placeholder={nameDialog?.kind === "file" ? "untitled.cpp" : nameDialog?.kind === "folder" ? "src" : "Name"}
              aria-label={nameTitle}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={closeNameDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={nameDialog?.kind !== "file" && !nameValue.trim()}>
                {nameDialog?.kind === "rename" || nameDialog?.kind === "rename-project" ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) closeDeleteDialog() }}>
        <AlertDialogContent
          className="z-[80] max-w-sm"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            asideRef.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === "folder" ? "Delete this folder?" : "Delete this file?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--cc-text-muted)]">
              {deleteTarget?.kind === "folder" ? (
                <>
                  <span className="font-medium text-[var(--cc-text)]">{deleteTarget.path}</span> and everything inside it will be removed from this project.
                  {deleteTarget.files + deleteTarget.folders > 0
                    ? ` That includes ${deleteTarget.files} file${deleteTarget.files === 1 ? "" : "s"} and ${deleteTarget.folders} folder${deleteTarget.folders === 1 ? "" : "s"}.`
                    : " The folder is empty."}{" "}
                  This cannot be undone.
                </>
              ) : deleteTarget ? (
                <>
                  <span className="font-medium text-[var(--cc-text)]">{deleteTarget.path}</span> will be removed from this project. This cannot be undone.
                </>
              ) : (
                "This cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--cc-danger,#dc2626)] text-white hover:opacity-90"
              onClick={() => {
                if (deleteTarget) onDeleteNode(deleteTarget.id)
                closeDeleteDialog()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
    <div ref={shieldRef} className="pointer-events-none fixed inset-0 z-[90]" aria-hidden />
    </>
  )
}
