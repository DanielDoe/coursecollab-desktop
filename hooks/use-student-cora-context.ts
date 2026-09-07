"use client"

import { useCallback, useEffect, useState } from "react"
import {
  buildStudentCoraContext,
  runStudentCoraContextSetup,
  type StudentCoraContext,
  type StudentCoraSetupStepId,
} from "@/lib/cora/student-cora-context"
import {
  isStudentCoraContextStale,
  loadStudentCoraContext,
  resolveStudentCoraCapabilities,
  saveStudentCoraContext,
} from "@/lib/cora/student-cora-context-store"
import type { StudentCoraCapability } from "@/lib/cora/student-capabilities"

export type StudentCoraSetupStatus = "loading" | "running" | "ready" | "error"

export function useStudentCoraContext(options: {
  studentId: string | null | undefined
  studentName?: string
  enabled?: boolean
}) {
  const { studentId, studentName, enabled = true } = options
  const [status, setStatus] = useState<StudentCoraSetupStatus>("loading")
  const [setupStep, setSetupStep] = useState<StudentCoraSetupStepId>("preparing")
  const [context, setContext] = useState<StudentCoraContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [setupToken, setSetupToken] = useState(0)

  useEffect(() => {
    if (!enabled || !studentId) {
      setStatus("loading")
      setContext(null)
      return
    }

    setContext((current) => (current?.studentId === studentId ? current : null))
    setStatus("loading")
    setError(null)

    let cancelled = false

    void (async () => {
      const stored = loadStudentCoraContext(studentId)
      if (cancelled) return

      if (stored?.setupComplete && stored.studentId === studentId && setupToken === 0) {
        setContext(stored)
        setStatus("ready")
        return
      }

      setStatus("running")
      setSetupStep("preparing")
      try {
        const built = await runStudentCoraContextSetup(studentId, {
          studentName,
          onStep: (step) => {
            if (!cancelled) setSetupStep(step)
          },
        })
        if (cancelled || built.studentId !== studentId) return
        saveStudentCoraContext(built)
        setContext(built)
        setStatus("ready")
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Could not prepare Cora for your course.")
        setStatus("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, studentId, studentName, setupToken])

  const retrySetup = useCallback(() => {
    setSetupToken((value) => value + 1)
  }, [])

  const refreshContextIfStale = useCallback(
    async (force = false) => {
      if (!studentId) return null
      const current = context ?? loadStudentCoraContext(studentId)
      if (!force && current && !isStudentCoraContextStale(current)) return current

      try {
        const response = await fetch("/api/ai-tutor/student-context", {
          headers: { "x-student-id": studentId },
        })
        if (!response.ok) return current
        const payload = await response.json()
        const built = buildStudentCoraContext(studentId, payload, studentName)
        saveStudentCoraContext(built)
        setContext(built)
        return built
      } catch {
        return current
      }
    },
    [studentId, studentName, context],
  )

  const capabilities: StudentCoraCapability[] = resolveStudentCoraCapabilities(context)

  return {
    status,
    setupStep,
    context,
    error,
    capabilities,
    retrySetup,
    refreshContextIfStale,
  }
}
