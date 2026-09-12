"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, FolderOpen, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import {
  CODEBENCH_LANGUAGE_OPTIONS,
  CODEBENCH_LANGUAGE_STORAGE_KEY,
  type CodebenchLanguageId,
  normalizeCodebenchLanguageId,
  readStoredCodebenchLanguageId,
} from "@/lib/codebench-languages"
import {
  INSTRUCTOR_CODEBENCH_EXPLORER_STORAGE_KEY,
  readInstructorCodebenchExplorerDefault,
} from "@/lib/codebench-instructor-scope"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function InstructorCodebenchSettingsPanel() {
  const chrome = facultyEmbedChrome("codebench")
  const { toast } = useToast()
  const [languageId, setLanguageId] = useState<CodebenchLanguageId>(() => readStoredCodebenchLanguageId())
  const [explorerOpen, setExplorerOpen] = useState(true)

  useEffect(() => {
    setExplorerOpen(readInstructorCodebenchExplorerDefault())
  }, [])

  const persistLanguage = useCallback(
    (next: CodebenchLanguageId) => {
      const normalized = normalizeCodebenchLanguageId(next)
      setLanguageId(normalized)
      localStorage.setItem(CODEBENCH_LANGUAGE_STORAGE_KEY, normalized)
      toast({ title: "Default language saved", description: "New files in the IDE will use this language." })
    },
    [toast],
  )

  const persistExplorer = useCallback(
    (open: boolean) => {
      setExplorerOpen(open)
      localStorage.setItem(INSTRUCTOR_CODEBENCH_EXPLORER_STORAGE_KEY, open ? "1" : "0")
      toast({
        title: "Explorer preference saved",
        description: open ? "File explorer opens by default in My Workspace." : "File explorer stays collapsed by default.",
      })
    },
    [toast],
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden pr-1">
      <div className={cn(chrome.card, "space-y-2 p-4 sm:p-5")}>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
          <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>CodeBench settings</h2>
        </div>
        <p className={cn("max-w-2xl text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
          Workspace defaults for your instructor IDE. Course-wide challenge and classroom policies are managed in
          Classroom Points.
        </p>
      </div>

      <div className={cn(chrome.card, "space-y-5 p-4 sm:p-5")}>
        <div className="space-y-2">
          <Label htmlFor="instructor-codebench-language" className={cn("text-sm font-medium", PORTAL_TEXT)}>
            Default language
          </Label>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Used when you create new files in My Workspace.</p>
          <Select value={languageId} onValueChange={(value) => persistLanguage(value as CodebenchLanguageId)}>
            <SelectTrigger id="instructor-codebench-language" className="w-full max-w-xs">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {CODEBENCH_LANGUAGE_OPTIONS.map((lang) => (
                <SelectItem key={lang.id} value={lang.id}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label htmlFor="instructor-codebench-explorer" className={cn("text-sm font-medium", PORTAL_TEXT)}>
              Show file explorer by default
            </Label>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Project tree visibility when opening My Workspace.</p>
          </div>
          <Switch
            id="instructor-codebench-explorer"
            checked={explorerOpen}
            onCheckedChange={persistExplorer}
          />
        </div>
      </div>

      <div className={cn(chrome.card, "space-y-3 p-4 sm:p-5")}>
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Course policies</p>
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          Challenge due dates, attempt rules, and Classroom Points approvals live in the assessments module — not in
          this local IDE shell.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/faculty/dashboard/assessments/classroom-points">
              Classroom Points
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/faculty/dashboard/assessments/classroom-points">
              <FolderOpen className="mr-1 h-3.5 w-3.5" />
              Manage challenges
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
