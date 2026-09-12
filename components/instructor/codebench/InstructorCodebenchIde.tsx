"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CodebenchExplorer } from "@/components/codebench/CodebenchExplorer"
import { CodebenchEditorChrome } from "@/components/codebench/CodebenchEditorChrome"
import {
  CodebenchEditorCoraSplit,
  type CodebenchCoraPanelControl,
} from "@/components/codebench/CodebenchEditorCoraSplit"
import { InstructorCodebenchToolbar } from "@/components/instructor/codebench/InstructorCodebenchToolbar"
import {
  InstructorCodebenchCoraPanel,
  type InstructorCodebenchCoraPanelHandle,
} from "@/components/instructor/codebench/InstructorCodebenchCoraPanel"
import { InstructorProjectStructurePreview } from "@/components/instructor/codebench/InstructorProjectStructurePreview"
import { InstructorClassroomQuestionDrawer } from "@/components/instructor/codebench/InstructorClassroomQuestionDrawer"
import type { InstructorClassroomHandoff } from "@/lib/codebench-instructor-classroom"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { useCodebenchIde } from "@/hooks/use-codebench-ide"
import { useInstructorProblemWorkspace } from "@/hooks/use-instructor-problem-workspace"
import { useCodebenchMonacoTheme } from "@/hooks/use-codebench-monaco-theme"
import { useToast } from "@/hooks/use-toast"
import {
  type CodebenchLanguageId,
  normalizeCodebenchLanguageId,
  readStoredCodebenchLanguageId,
  resolveEffectiveCodebenchLanguage,
} from "@/lib/codebench-languages"
import { instructorCodebenchOwnerKey, readInstructorCodebenchExplorerDefault } from "@/lib/codebench-instructor-scope"
import { recordProjectSnapshot } from "@/lib/codebench-instructor-version-history"
import { filePath, isFileDirty } from "@/lib/codebench-ide-workspace"
import {
  applyCodebenchMonacoTheme,
  registerCodebenchMonacoThemes,
  codebenchEditorOptions,
  type CodebenchMonacoThemeName,
} from "@/lib/codebench-monaco-themes"
import { cn } from "@/lib/utils"
import {
  CodeBenchExecutionDock,
  type CodeBenchExecutionHandle,
  type CodeBenchExecutionMeta,
} from "@/src/features/codebench/components/CodeBenchExecutionDock"
import type { CodeBenchRunResult } from "@/src/features/codebench/hooks/useCodeRunner"
import type { InstructorLibraryItem } from "@/lib/codebench-instructor-library"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false })

type Props = {
  className?: string
  importLibraryItem?: InstructorLibraryItem | null
  onLibraryImportHandled?: () => void
  importClassroomAssignment?: InstructorClassroomHandoff | null
  onClassroomImportHandled?: () => void
}

export function InstructorCodebenchIde({
  className,
  importLibraryItem = null,
  onLibraryImportHandled,
  importClassroomAssignment = null,
  onClassroomImportHandled,
}: Props) {
  const { toast } = useToast()
  const { panelTheme, editorTheme } = useCodebenchMonacoTheme()
  const ownerKey = useMemo(() => instructorCodebenchOwnerKey(), [])
  const ide = useCodebenchIde({ studentId: ownerKey })
  const problemWorkspace = useInstructorProblemWorkspace(ide, ownerKey)
  const { openLibraryProblem, openClassroomProblem, flushActiveScope } = problemWorkspace
  const lastLibraryImportRef = useRef<string | null>(null)
  const lastClassroomImportRef = useRef<number | null>(null)
  const appliedExplorerPrefRef = useRef(false)
  const executionRef = useRef<CodeBenchExecutionHandle | null>(null)
  const coraPanelRef = useRef<InstructorCodebenchCoraPanelHandle | null>(null)
  const editorColumnRef = useRef<HTMLDivElement | null>(null)
  const [executionMeta, setExecutionMeta] = useState<CodeBenchExecutionMeta | null>(null)
  const [lastCompilerOutput, setLastCompilerOutput] = useState("")
  const [languageId, setLanguageId] = useState<CodebenchLanguageId>(() => readStoredCodebenchLanguageId())
  const [editorRef, setEditorRef] = useState<{ layout: () => void; getDomNode?: () => HTMLElement | null } | null>(
    null,
  )
  const [coraPanelControl, setCoraPanelControl] = useState<CodebenchCoraPanelControl | null>(null)
  const [activeClassroomAssignment, setActiveClassroomAssignment] = useState<InstructorClassroomHandoff | null>(null)
  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false)
  const [editorExpanded, setEditorExpanded] = useState(false)
  const monacoApiRef = useRef<{ editor: { setTheme: (name: string) => void } } | null>(null)

  const activeFile = ide.activeFile
  const code = activeFile?.content ?? ""
  const currentLanguage = resolveEffectiveCodebenchLanguage(activeFile?.languageId ?? languageId, code)
  const lineCount = code ? code.split("\n").length : 1

  const layoutMonacoEditor = useCallback(() => {
    try {
      if (!editorRef?.layout) return
      requestAnimationFrame(() => {
        editorRef.layout()
      })
    } catch {
      // Ignore layout errors while panels are settling.
    }
  }, [editorRef])

  useEffect(() => {
    if (!editorRef) return
    const container = editorRef.getDomNode?.()?.parentElement
    if (!container) return
    const observer = new ResizeObserver(() => {
      try {
        requestAnimationFrame(() => editorRef.layout())
      } catch {
        // Ignore layout errors while panels are settling.
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [editorRef])

  useEffect(() => {
    if (!ide.hydrated || appliedExplorerPrefRef.current) return
    appliedExplorerPrefRef.current = true
    ide.setExplorerOpen(readInstructorCodebenchExplorerDefault())
  }, [ide.hydrated, ide.setExplorerOpen])

  useEffect(() => {
    if (!editorExpanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditorExpanded(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editorExpanded])

  useEffect(() => {
    layoutMonacoEditor()
  }, [editorExpanded, layoutMonacoEditor])

  useEffect(() => {
    applyCodebenchMonacoTheme(monacoApiRef.current, editorTheme)
  }, [editorTheme])

  useEffect(() => {
    if (!importLibraryItem) {
      lastLibraryImportRef.current = null
      return
    }
    if (!ide.hydrated) return
    if (lastLibraryImportRef.current === importLibraryItem.id) return
    lastLibraryImportRef.current = importLibraryItem.id
    setActiveClassroomAssignment(null)
    setQuestionDrawerOpen(false)
    void openLibraryProblem(importLibraryItem).then(() => {
      setLanguageId(importLibraryItem.languageId)
      toast({
        title: "Problem workspace opened",
        description: `${importLibraryItem.title} — your progress is saved separately for each problem.`,
      })
      onLibraryImportHandled?.()
    })
  }, [ide.hydrated, importLibraryItem, onLibraryImportHandled, openLibraryProblem, toast])

  useEffect(() => {
    if (!importClassroomAssignment) {
      lastClassroomImportRef.current = null
      return
    }
    if (!ide.hydrated) return
    if (lastClassroomImportRef.current === importClassroomAssignment.submissionId) return
    lastClassroomImportRef.current = importClassroomAssignment.submissionId
    setActiveClassroomAssignment(importClassroomAssignment)
    setQuestionDrawerOpen(true)

    if (importClassroomAssignment.submissionKind !== CLASSROOM_SUBMISSION_KIND_CODE) {
      toast({
        title: "Classroom assignment loaded",
        description: `${importClassroomAssignment.title} — reference the question panel while teaching.`,
      })
      onClassroomImportHandled?.()
      return
    }

    void openClassroomProblem(importClassroomAssignment).then(() => {
      setLanguageId(importClassroomAssignment.languageId)
      toast({
        title: "Classroom assignment loaded",
        description: `${importClassroomAssignment.title} — pick up where you left off anytime.`,
      })
      onClassroomImportHandled?.()
    })
  }, [ide.hydrated, importClassroomAssignment, onClassroomImportHandled, openClassroomProblem, toast])

  const handleLanguageChange = useCallback(
    (next: CodebenchLanguageId) => {
      const normalized = normalizeCodebenchLanguageId(next)
      setLanguageId(normalized)
      if (activeFile) {
        ide.setFileLanguage(normalized)
      }
    },
    [activeFile, ide],
  )

  const handleSave = useCallback(() => {
    ide.saveActive()
    void flushActiveScope()
    const files = ide.project.nodes
      .filter((node) => node.kind === "file")
      .map((node) => ({ path: filePath(ide.project, node.id), content: node.content ?? "" }))
    recordProjectSnapshot({
      projectId: ide.project.id,
      label: `Saved ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      files,
      ownerKey,
    })
    toast({ title: "Saved", description: "Project snapshot recorded in version history." })
  }, [flushActiveScope, ide, ownerKey, toast])

  const handleRun = useCallback(() => {
    if (currentLanguage.id !== "cpp") {
      toast({
        title: "Local run unavailable",
        description: "Desktop execution currently supports C++ in CodeBench.",
        variant: "destructive",
      })
      return
    }
    void executionRef.current?.run(code)
  }, [code, currentLanguage.id, toast])

  const handleRunResult = useCallback((result: CodeBenchRunResult) => {
    const output = result.stderr?.trim()
    if (output) setLastCompilerOutput(output)
  }, [])

  const handleSuggestFix = useCallback(
    ({ stderr }: { stderr: string }) => {
      const output = stderr.trim()
      if (!output) return
      setLastCompilerOutput(output)
      coraPanelControl?.expand()
      coraPanelRef.current?.runDebug(output)
    },
    [coraPanelControl],
  )

  const editorPane = (
    <>
      <CodebenchEditorChrome
        lineCount={lineCount}
        language={currentLanguage.label}
        fileName={activeFile?.name ?? currentLanguage.fileName}
        compact
        theme={panelTheme}
        dirty={ide.dirty}
        naming={ide.naming}
        activeFileId={activeFile?.id}
        openFiles={ide.project.openFileIds
          .map((id) => ide.project.nodes.find((node) => node.id === id && node.kind === "file"))
          .filter((node): node is NonNullable<typeof node> => Boolean(node))
          .map((node) => ({ id: node.id, name: node.name, dirty: isFileDirty(node) }))}
        onSelectFile={ide.openFile}
        onCloseFile={ide.closeFile}
      />
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--card)]">
        <MonacoEditor
          key={activeFile?.id ?? "file"}
          height="100%"
          language={currentLanguage.monacoLanguage}
          value={code}
          onChange={(value) => ide.setActiveContent(value ?? "")}
          theme={editorTheme}
          beforeMount={(monaco) => registerCodebenchMonacoThemes(monaco)}
          onMount={(editor, monaco) => {
            monacoApiRef.current = monaco
            applyCodebenchMonacoTheme(monaco, editorTheme as CodebenchMonacoThemeName)
            setEditorRef(editor)
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave())
          }}
          options={codebenchEditorOptions()}
        />
      </div>
    </>
  )

  if (!ide.hydrated) {
    return (
      <div className={cn("flex min-h-[420px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]", className)}>
        <p className="text-sm text-[var(--cc-text-muted)]">Loading instructor workspace…</p>
      </div>
    )
  }

  return (
      <div
        className={cn(
          "instructor-codebench-ide @container/codebench-ide relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]",
          editorExpanded
            ? "fixed inset-3 z-[70] shadow-2xl sm:inset-4"
            : cn("flex-1", className),
        )}
      >
        <InstructorCodebenchToolbar
          languageId={currentLanguage.id}
          onLanguageChange={handleLanguageChange}
          projectName={ide.project.name}
          fileName={activeFile?.name}
          classroomTitle={activeClassroomAssignment?.title}
          explorerOpen={ide.explorerOpen}
          onToggleExplorer={() => ide.setExplorerOpen((open) => !open)}
          onSave={handleSave}
          canSave={ide.dirty || Boolean(activeFile?.untitled)}
          onRun={handleRun}
          onStop={() => void executionRef.current?.stop()}
          runState={executionMeta?.runState}
          runEnabled={currentLanguage.id === "cpp" && Boolean(executionMeta?.compilerReady ?? executionMeta?.available)}
          questionOpen={questionDrawerOpen}
          onToggleQuestion={
            activeClassroomAssignment ? () => setQuestionDrawerOpen((value) => !value) : undefined
          }
          coraOpen={!coraPanelControl?.collapsed}
          onToggleCora={coraPanelControl ? () => coraPanelControl.toggleCollapse() : undefined}
          editorExpanded={editorExpanded}
          onToggleEditorExpanded={() => setEditorExpanded((value) => !value)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {ide.explorerOpen ? (
            <CodebenchExplorer
              variant="instructor"
              headerSlot={<InstructorProjectStructurePreview project={ide.project} />}
              project={ide.project}
              projects={ide.projects}
              activeFileId={activeFile?.id ?? null}
              onSwitchProject={ide.switchProject}
              onCreateProject={ide.createProject}
              onRenameProject={ide.renameProject}
              onOpenFile={ide.openFile}
              onCreateFile={(parentId, name) => ide.createFile({ parentId, name })}
              onCreateFolder={ide.createFolder}
              onRenameNode={ide.renameNode}
              onDeleteNode={ide.deleteNode}
              localRoot={ide.canUseLocalFiles ? ide.localRoot : null}
              onRevealLocalFolder={ide.canUseLocalFiles ? () => void ide.revealLocalFolder() : undefined}
              onChooseLocalFolder={ide.canUseLocalFiles ? () => void ide.chooseLocalFolder() : undefined}
            />
          ) : null}

          <div
            ref={editorColumnRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <CodebenchEditorCoraSplit
              embedded
              className="min-h-0 flex-1"
              onPanelResize={layoutMonacoEditor}
              onCoraPanelControl={setCoraPanelControl}
              editor={<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{editorPane}</div>}
              cora={
                <InstructorCodebenchCoraPanel
                  ref={coraPanelRef}
                  code={code}
                  language={currentLanguage.apiLanguage}
                  theme={panelTheme}
                  compilerOutput={lastCompilerOutput}
                />
              }
            />
            <CodeBenchExecutionDock
              ref={executionRef}
              layoutBoundsRef={editorColumnRef}
              theme={panelTheme}
              canExecute={currentLanguage.id === "cpp"}
              unsupportedMessage={
                currentLanguage.id === "cpp"
                  ? undefined
                  : "Local execution is available for C++ in the desktop CodeBench shell."
              }
              onMetaChange={setExecutionMeta}
              onRunResult={handleRunResult}
              onSuggestFix={handleSuggestFix}
              onDockResize={layoutMonacoEditor}
            />
          </div>
        </div>

        <InstructorClassroomQuestionDrawer
          open={questionDrawerOpen}
          onClose={() => setQuestionDrawerOpen(false)}
          assignment={activeClassroomAssignment}
        />
      </div>
  )
}
