"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  getFacultyCoraGithubStatus,
  submitFacultyCoraGithubFix,
} from "@/lib/cora/faculty-cora-client"

type Props = {
  open: boolean
  onClose: () => void
  initialTitle?: string
  initialDescription?: string
  /** Optional prefilled files from Cora reply fences. */
  initialFiles?: { path: string; content: string }[]
}

function parseCodeFenceFiles(text: string): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = []
  const re = /```([^\n`]+)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const header = match[1].trim()
    const content = match[2].replace(/\n$/, "")
    if (!content.trim()) continue
    // Accept "ts path/file.ts" or bare "path/file.ts"
    const parts = header.split(/\s+/)
    const maybePath = parts.find((p) => p.includes("/")) || parts[parts.length - 1]
    if (!maybePath || maybePath === "json" || maybePath === "bash") continue
    if (!/[./]/.test(maybePath)) continue
    files.push({ path: maybePath.replace(/^\/+/, ""), content })
  }
  return files
}

export function FacultyCoraGithubFixDialog({
  open,
  onClose,
  initialTitle = "",
  initialDescription = "",
  initialFiles,
}: Props) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [filesJson, setFilesJson] = useState("[]")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(initialTitle || "Cora Copilot fix")
    setDescription(initialDescription || "")
    const files =
      initialFiles?.length
        ? initialFiles
        : parseCodeFenceFiles(initialDescription)
    setFilesJson(JSON.stringify(files, null, 2))
    void getFacultyCoraGithubStatus()
      .then((res) => setEnabled(Boolean(res.enabled)))
      .catch(() => setEnabled(false))
  }, [open, initialTitle, initialDescription, initialFiles])

  const submit = async () => {
    let files: { path: string; content: string }[] = []
    try {
      const parsed = JSON.parse(filesJson) as unknown
      if (!Array.isArray(parsed)) throw new Error("Files must be a JSON array")
      files = parsed
        .map((row) => ({
          path: String((row as { path?: string }).path ?? "").trim(),
          content: String((row as { content?: string }).content ?? ""),
        }))
        .filter((row) => row.path && row.content)
    } catch (error) {
      toast({
        title: "Invalid files JSON",
        description: error instanceof Error ? error.message : "Fix the files payload",
        variant: "destructive",
      })
      return
    }

    if (!title.trim() || !files.length) {
      toast({
        title: "Title and at least one file required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await submitFacultyCoraGithubFix({
        title: title.trim(),
        description: description.trim(),
        files,
      })
      if (!res.success) throw new Error(res.message)
      toast({
        title: "Pull request opened",
        description: res.pullRequestUrl || res.message,
      })
      if (res.pullRequestUrl) window.open(res.pullRequestUrl, "_blank", "noopener,noreferrer")
      onClose()
    } catch (error) {
      toast({
        title: "Submit failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit GitHub fix</DialogTitle>
          <DialogDescription>
            Creates a branch, commits Cora-proposed file changes, and opens a pull request for review.
          </DialogDescription>
        </DialogHeader>

        {enabled === false ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            GitHub is not configured on this server yet. Set <code>GITHUB_TOKEN</code> /
            <code>CORA_GITHUB_TOKEN</code> plus <code>CORA_GITHUB_OWNER</code> and{" "}
            <code>CORA_GITHUB_REPO</code>.
          </p>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gh-title">PR title</Label>
            <Input id="gh-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-desc">Description</Label>
            <Textarea
              id="gh-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-files">Files JSON</Label>
            <Textarea
              id="gh-files"
              rows={10}
              value={filesJson}
              onChange={(e) => setFilesJson(e.target.value)}
              className="font-mono text-xs"
              placeholder='[{"path":"lib/example.ts","content":"..."}]'
            />
            <p className="text-xs text-[var(--cc-text-muted)]">
              Prefills from fenced code blocks in Cora&apos;s reply when paths are present.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || enabled === false} onClick={() => void submit()}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Open pull request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
