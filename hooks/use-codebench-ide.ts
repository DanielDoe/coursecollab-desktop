"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import {
  type CodebenchLanguageId,
  editorCodeForLanguage,
  isCodebenchBoilerplate,
} from "@/lib/codebench-languages"
import {
  type IdeNode,
  type IdeProject,
  type IdeWorkspace,
  addFileToProject,
  addFolderToProject,
  addProject,
  applyCoraFileName,
  canUseLocalProjectFiles,
  closeFileInProject,
  deleteNodeInProject,
  getActiveFile,
  getActiveProject,
  heuristicFileName,
  isFileDirty,
  isPlaceholderWorkspace,
  loadIdeWorkspace,
  openFileInProject,
  persistIdeWorkspace,
  persistIdeWorkspaceCloud,
  persistIdeWorkspaceDurable,
  persistIdeWorkspaceProjectFiles,
  renameNodeInProject,
  resolvePersistedIdeWorkspace,
  saveFileInProject,
  setFileLanguageInProject,
  shouldAskCoraToName,
  updateFileContent,
  updateProject,
  workspaceUpdatedAt,
} from "@/lib/codebench-ide-workspace"

type Options = {
  studentId?: string | null
}

function withProject(workspace: IdeWorkspace, next: IdeProject): IdeWorkspace {
  return updateProject(workspace, next.id, next)
}

export function useCodebenchIde({ studentId = null }: Options = {}) {
  const [workspace, setWorkspace] = useState<IdeWorkspace>(() => loadIdeWorkspace(studentId))
  const [hydrated, setHydrated] = useState(false)
  const [localRoot, setLocalRoot] = useState<string | null>(null)
  const namingRef = useRef<string | null>(null)
  const [namingFileId, setNamingFileId] = useState<string | null>(null)
  const workspaceRef = useRef(workspace)
  workspaceRef.current = workspace

  useEffect(() => {
    let cancelled = false
    setHydrated(false)
    void resolvePersistedIdeWorkspace(studentId).then((loaded) => {
      if (cancelled) return
      setWorkspace(loaded)
      persistIdeWorkspace(loaded, studentId)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [studentId])

  useEffect(() => {
    persistIdeWorkspace(workspace, studentId)
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      void persistIdeWorkspaceDurable(workspace, studentId)
      void persistIdeWorkspaceProjectFiles(workspace, studentId)
    }, 400)
    const cloudTimer = window.setTimeout(() => {
      if (!studentId || isPlaceholderWorkspace(workspace)) return
      void persistIdeWorkspaceCloud(workspace, studentId).then((newer) => {
        if (
          newer &&
          workspaceUpdatedAt(newer) > workspaceUpdatedAt(workspaceRef.current)
        ) {
          setWorkspace(newer)
        }
      })
    }, 1600)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(cloudTimer)
    }
  }, [hydrated, studentId, workspace])

  useEffect(() => {
    if (!hydrated) return
    const flush = () => {
      persistIdeWorkspace(workspace, studentId)
      void persistIdeWorkspaceDurable(workspace, studentId)
      void persistIdeWorkspaceProjectFiles(workspace, studentId)
      if (studentId && !isPlaceholderWorkspace(workspace)) {
        void persistIdeWorkspaceCloud(workspace, studentId)
      }
    }
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", flush)
    return () => {
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", flush)
    }
  }, [hydrated, studentId, workspace])

  useEffect(() => {
    if (!canUseLocalProjectFiles() || !window.courseCollabDesktop?.codebench.getLocalProjectsRoot) {
      setLocalRoot(null)
      return
    }
    void window.courseCollabDesktop.codebench.getLocalProjectsRoot(studentId).then((result) => {
      if (result.ok) setLocalRoot(result.path)
    })
  }, [studentId])

  const project = useMemo(() => getActiveProject(workspace), [workspace])
  const activeFile = useMemo(() => getActiveFile(project), [project])
  const activeContent = activeFile?.content ?? ""
  const dirty = isFileDirty(activeFile)

  const patchProject = useCallback((updater: (current: IdeProject) => IdeProject) => {
    setWorkspace((current) => withProject(current, updater(getActiveProject(current))))
  }, [])

  const setActiveContent = useCallback(
    (content: string) => {
      const fileId = activeFile?.id
      if (!fileId) return
      patchProject((current) => updateFileContent(current, fileId, content))
    },
    [activeFile?.id, patchProject],
  )

  const openFile = useCallback(
    (fileId: string) => {
      patchProject((current) => openFileInProject(current, fileId))
    },
    [patchProject],
  )

  const closeFile = useCallback(
    (fileId: string) => {
      patchProject((current) => closeFileInProject(current, fileId))
    },
    [patchProject],
  )

  const createFile = useCallback(
    (options?: { parentId?: string | null; languageId?: CodebenchLanguageId; name?: string }) => {
      patchProject((current) =>
        addFileToProject(current, {
          parentId: options?.parentId ?? null,
          languageId: options?.languageId ?? activeFile?.languageId ?? "cpp",
          name: options?.name,
          untitled: !options?.name,
        }),
      )
    },
    [activeFile?.languageId, patchProject],
  )

  const createFolder = useCallback(
    (name = "src", parentId: string | null = null) => {
      patchProject((current) => addFolderToProject(current, name, parentId))
    },
    [patchProject],
  )

  const createProject = useCallback((name: string) => {
    setWorkspace((current) => addProject(current, name))
  }, [])

  const switchProject = useCallback((projectId: string) => {
    setWorkspace((current) =>
      current.projects.some((item) => item.id === projectId)
        ? { ...current, activeProjectId: projectId }
        : current,
    )
  }, [])

  const renameProject = useCallback((name: string) => {
    patchProject((current) => ({ ...current, name: name.trim() || current.name, updatedAt: Date.now() }))
  }, [patchProject])

  const renameNode = useCallback(
    (nodeId: string, name: string) => {
      patchProject((current) => renameNodeInProject(current, nodeId, name))
    },
    [patchProject],
  )

  const deleteNode = useCallback(
    (nodeId: string) => {
      patchProject((current) => deleteNodeInProject(current, nodeId))
    },
    [patchProject],
  )

  const saveActive = useCallback(() => {
    if (!activeFile) return
    patchProject((current) => saveFileInProject(current, activeFile.id))
  }, [activeFile, patchProject])

  const setExplorerOpen = useCallback((open: boolean | ((value: boolean) => boolean)) => {
    setWorkspace((current) => ({
      ...current,
      explorerOpen: typeof open === "function" ? open(current.explorerOpen) : open,
    }))
  }, [])

  const setFileLanguage = useCallback(
    (languageId: CodebenchLanguageId, content?: string) => {
      if (!activeFile) return
      const currentLanguage = activeFile.languageId ?? languageId
      const nextContent =
        content ??
        (isCodebenchBoilerplate(activeFile.content ?? "", currentLanguage)
          ? editorCodeForLanguage(languageId, { preferTemplate: true })
          : activeFile.content)
      patchProject((current) => setFileLanguageInProject(current, activeFile.id, languageId, nextContent))
    },
    [activeFile, patchProject],
  )

  const nameWithCora = useCallback(
    async (file: IdeNode | null = activeFile) => {
      if (!file || !shouldAskCoraToName(file) || namingRef.current === file.id) return
      namingRef.current = file.id
      setNamingFileId(file.id)
      const languageId = file.languageId ?? "cpp"
      const fallback = heuristicFileName(file.content ?? "", languageId)
      try {
        let filename = fallback
        let projectHint: string | null = null
        if (studentId) {
          const response = await studentApiFetch("/api/codebench/name-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId,
              code: file.content,
              language: languageId,
              projectName: project.name,
            }),
          })
          if (response.ok) {
            const data = (await response.json()) as { filename?: string; projectHint?: string | null }
            if (data.filename) filename = data.filename
            projectHint = data.projectHint ?? null
          }
        }
        patchProject((current) => {
          const next = applyCoraFileName(current, file.id, filename)
          if (projectHint && /^my project$/i.test(current.name)) {
            return { ...next, name: projectHint }
          }
          return next
        })
      } catch {
        patchProject((current) => applyCoraFileName(current, file.id, fallback))
      } finally {
        if (namingRef.current === file.id) namingRef.current = null
        setNamingFileId((current) => (current === file.id ? null : current))
      }
    },
    [activeFile, patchProject, project.name, studentId],
  )

  useEffect(() => {
    if (!shouldAskCoraToName(activeFile)) return
    const timer = window.setTimeout(() => {
      void nameWithCora(activeFile)
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [activeFile, nameWithCora])

  const revealLocalFolder = useCallback(async () => {
    const result = await window.courseCollabDesktop?.codebench.revealLocalProjectsFolder?.()
    return result ?? { ok: false, path: localRoot ?? "" }
  }, [localRoot])

  const chooseLocalFolder = useCallback(async () => {
    const result = await window.courseCollabDesktop?.codebench.chooseLocalProjectsFolder?.()
    if (result?.ok) {
      const next = await window.courseCollabDesktop?.codebench.getLocalProjectsRoot?.(studentId)
      setLocalRoot(next?.path ?? result.path)
      void persistIdeWorkspaceProjectFiles(workspaceRef.current, studentId)
    }
    return result ?? { ok: false, path: localRoot ?? "", canceled: true }
  }, [localRoot, studentId])

  return {
    workspace,
    project,
    projects: workspace.projects,
    explorerOpen: workspace.explorerOpen,
    setExplorerOpen,
    activeFile,
    activeContent,
    setActiveContent,
    dirty,
    naming: namingFileId === activeFile?.id,
    localRoot,
    canUseLocalFiles: canUseLocalProjectFiles(),
    revealLocalFolder,
    chooseLocalFolder,
    openFile,
    closeFile,
    createFile,
    createFolder,
    createProject,
    switchProject,
    renameProject,
    renameNode,
    deleteNode,
    saveActive,
    setFileLanguage,
    nameWithCora,
  }
}
