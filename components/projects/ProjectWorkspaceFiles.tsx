"use client"

import { useState } from "react"
import { ExternalLink, FileText, ImageIcon, Paperclip, Trash2 } from "lucide-react"
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
import { ProjectFileDropzone } from "@/components/projects/ProjectFileDropzone"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { portalListStripe } from "@/lib/portal-module-themes"

export type WorkspaceFileRow = {
  id?: number
  file_name?: unknown
  storage_url?: unknown
  mime_type?: unknown
  byte_size?: unknown
  created_at?: unknown
  uploaded_by_student_id?: unknown
}

function formatBytes(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(+date)) return null
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fileKind(name: string, mime: string) {
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(name)) return "image" as const
  if (mime.includes("pdf") || /\.pdf$/i.test(name)) return "pdf" as const
  return "file" as const
}

export function ProjectWorkspaceFiles({
  files,
  members,
  busy,
  onUpload,
  onDelete,
}: {
  files: WorkspaceFileRow[]
  members: Array<{ id: number; full_name: string }>
  busy?: boolean
  onUpload: (file: File) => Promise<void>
  onDelete: (fileId: number) => Promise<void>
}) {
  const [pending, setPending] = useState<{ id: number; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)

  const confirmDelete = async () => {
    if (!pending) return
    setRemoving(true)
    try {
      await onDelete(pending.id)
      setPending(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
      <ProjectFileDropzone
        busy={busy}
        onFiles={(picked) => {
          void (async () => {
            for (const file of picked) await onUpload(file)
          })()
        }}
      />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Uploaded files</p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Open a file or remove it from this workspace.</p>
          </div>
          <p className={cn("shrink-0 text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
            {files.length} {files.length === 1 ? "file" : "files"}
          </p>
        </div>

        {files.length === 0 ? (
          <div className="border-t border-[var(--border)] px-4 py-10 text-center">
            <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
              <Paperclip className="h-4 w-4" />
            </span>
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No files yet</p>
            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Drop files on the left to add them here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {files.map((file, index) => {
              const id = Number(file.id)
              const name = String(file.file_name || "Untitled")
              const url = String(file.storage_url || "")
              const mime = String(file.mime_type || "")
              const kind = fileKind(name, mime)
              const stripe = portalListStripe(index, "amber")
              const size = formatBytes(file.byte_size)
              const when = formatWhen(file.created_at)
              const uploader = members.find((member) => Number(member.id) === Number(file.uploaded_by_student_id))
              const Icon = kind === "pdf" ? FileText : kind === "image" ? ImageIcon : Paperclip
              return (
                <li key={Number.isFinite(id) ? id : `${name}-${index}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
                  {kind === "image" && url ? (
                    <img
                      src={url}
                      alt=""
                      className="size-10 shrink-0 rounded-xl object-cover border border-[var(--border)]"
                    />
                  ) : (
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                      <Icon className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)} title={name}>
                      {name}
                    </p>
                    <p className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>
                      {[size, when, uploader?.full_name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {url ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${name}`}>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                    {Number.isFinite(id) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--cc-text-muted)] hover:text-red-600"
                        aria-label={`Delete ${name}`}
                        disabled={busy || removing}
                        onClick={() => setPending({ id, name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={pending != null} onOpenChange={(open) => { if (!open && !removing) setPending(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? `“${pending.name}” will be removed from the workspace. This cannot be undone.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {removing ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
