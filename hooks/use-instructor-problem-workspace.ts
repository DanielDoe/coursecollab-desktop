"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CodebenchLanguageId } from "@/lib/codebench-languages"
import type { InstructorClassroomHandoff } from "@/lib/codebench-instructor-classroom"
import type { InstructorLibraryItem } from "@/lib/codebench-instructor-library"
import {
  buildFreshProblemProject,
  instructorProblemProjectId,
  isInstructorProblemProjectId,
  parseInstructorProblemProjectId,
  persistInstructorProblemRecord,
  persistInstructorProblemRecordDurable,
  resolveInstructorProblemRecord,
  type InstructorProblemRecord,
  type InstructorProblemScope,
} from "@/lib/codebench-instructor-problem-workspaces"
import type { useCodebenchIde } from "@/hooks/use-codebench-ide"

type IdeApi = ReturnType<typeof useCodebenchIde>

type ActiveProblemMeta = {
  title: string
  languageId: CodebenchLanguageId
}

function scopeFromClassroom(handoff: InstructorClassroomHandoff): InstructorProblemScope {
  return { kind: "classroom", id: String(handoff.submissionId) }
}

function scopeFromLibrary(item: InstructorLibraryItem): InstructorProblemScope {
  return { kind: "library", id: item.id }
}

function starterFromLibrary(item: InstructorLibraryItem) {
  const primary = item.files[0]
  return {
    languageId: item.languageId,
    starterCode: primary?.content ?? "",
    starterFileName: primary?.path.split("/").pop() ?? "main.cpp",
  }
}

export function useInstructorProblemWorkspace(ide: IdeApi, ownerKey: string) {
  const activeScopeRef = useRef<InstructorProblemScope | null>(null)
  const activeMetaRef = useRef<ActiveProblemMeta | null>(null)
  const [activeScope, setActiveScope] = useState<InstructorProblemScope | null>(null)
  const openingRef = useRef(false)

  const saveScope = useCallback(
    async (scope: InstructorProblemScope, meta: ActiveProblemMeta) => {
      const projectId = instructorProblemProjectId(scope)
      const project =
        ide.project.id === projectId
          ? ide.project
          : ide.projects.find((item) => item.id === projectId) ?? ide.project

      const record: InstructorProblemRecord = {
        version: 1,
        scope,
        title: meta.title,
        languageId: meta.languageId,
        project: {
          ...project,
          id: projectId,
          name: meta.title,
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }
      persistInstructorProblemRecord(record, ownerKey)
      await persistInstructorProblemRecordDurable(record, ownerKey)
    },
    [ide.project, ide.projects, ownerKey],
  )

  const flushActiveScope = useCallback(async () => {
    const scope = activeScopeRef.current
    const meta = activeMetaRef.current
    if (!scope || !meta || !ide.hydrated || openingRef.current) return
    await saveScope(scope, meta)
  }, [ide.hydrated, saveScope])

  const openScopedProblem = useCallback(
    async (scope: InstructorProblemScope, meta: ActiveProblemMeta, starter: {
      languageId: CodebenchLanguageId
      starterCode: string
      starterFileName: string
    }) => {
      if (!ide.hydrated) return
      openingRef.current = true
      try {
        await flushActiveScope()

        const existing = await resolveInstructorProblemRecord(scope, ownerKey)
        const project =
          existing?.project ??
          buildFreshProblemProject({
            scope,
            title: meta.title,
            languageId: starter.languageId,
            starterCode: starter.starterCode,
            starterFileName: starter.starterFileName,
          })

        ide.upsertAndSwitchProject(project)
        activeScopeRef.current = scope
        activeMetaRef.current = meta
        setActiveScope(scope)
      } finally {
        openingRef.current = false
      }
    },
    [flushActiveScope, ide, ownerKey],
  )

  const openClassroomProblem = useCallback(
    async (handoff: InstructorClassroomHandoff) => {
      const scope = scopeFromClassroom(handoff)
      await openScopedProblem(
        scope,
        { title: handoff.title, languageId: handoff.languageId },
        {
          languageId: handoff.languageId,
          starterCode: handoff.starterCode,
          starterFileName: handoff.starterFileName,
        },
      )
    },
    [openScopedProblem],
  )

  const openLibraryProblem = useCallback(
    async (item: InstructorLibraryItem) => {
      const scope = scopeFromLibrary(item)
      const starter = starterFromLibrary(item)
      await openScopedProblem(scope, { title: item.title, languageId: starter.languageId }, starter)
    },
    [openScopedProblem],
  )

  useEffect(() => {
    if (!activeScope || !activeMetaRef.current || !ide.hydrated || openingRef.current) return
    if (ide.project.id !== instructorProblemProjectId(activeScope)) return

    const timer = window.setTimeout(() => {
      void saveScope(activeScope, activeMetaRef.current!)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [activeScope, ide.hydrated, ide.project, saveScope])

  useEffect(() => {
    if (!ide.hydrated || openingRef.current) return
    const parsed = parseInstructorProblemProjectId(ide.project.id)
    if (parsed) {
      if (
        !activeScopeRef.current ||
        activeScopeRef.current.kind !== parsed.kind ||
        activeScopeRef.current.id !== parsed.id
      ) {
        activeScopeRef.current = parsed
        setActiveScope(parsed)
      }
      return
    }
    if (activeScopeRef.current) {
      void flushActiveScope().finally(() => {
        activeScopeRef.current = null
        activeMetaRef.current = null
        setActiveScope(null)
      })
    }
  }, [flushActiveScope, ide.hydrated, ide.project.id])

  useEffect(() => {
    if (!ide.hydrated) return
    const flush = () => {
      void flushActiveScope()
    }
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", flush)
    return () => {
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", flush)
    }
  }, [flushActiveScope, ide.hydrated])

  return {
    activeScope,
    isProblemProject: isInstructorProblemProjectId(ide.project.id),
    openClassroomProblem,
    openLibraryProblem,
    flushActiveScope,
  }
}
