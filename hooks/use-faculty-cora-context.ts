"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  FACULTY_CORA_CAPABILITIES,
  applyFacultyCoraPlaybook,
  type FacultyCoraCapability,
} from "@/lib/cora/faculty-capabilities"
import { fetchFacultyCoraContext, fetchFacultyCoraInsights, type FacultyCoraInsight } from "@/lib/cora/faculty-cora-client"

export type FacultyCoraSetupStepId = "preparing" | "course" | "chats" | "playbook" | "ready"

export const FACULTY_CORA_SETUP_STEPS: Array<{ id: FacultyCoraSetupStepId; label: string }> = [
  { id: "preparing", label: "Preparing teaching context" },
  { id: "course", label: "Scanning course materials" },
  { id: "chats", label: "Reading chats and activity" },
  { id: "playbook", label: "Building capability playbook" },
  { id: "ready", label: "Ready" },
]

type Status = "idle" | "loading" | "ready" | "error"

export function useFacultyCoraContext(enabled: boolean) {
  const [status, setStatus] = useState<Status>("idle")
  const [setupStep, setSetupStep] = useState<FacultyCoraSetupStepId>("preparing")
  const [error, setError] = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState<string | null>(null)
  const [courseCode, setCourseCode] = useState<string | null>(null)
  const [playbook, setPlaybook] = useState<
    NonNullable<Awaited<ReturnType<typeof fetchFacultyCoraContext>>["context"]["playbook"]> | null
  >(null)
  const [insights, setInsights] = useState<FacultyCoraInsight[]>([])

  const skipSetup = useCallback(() => {
    setStatus("ready")
    setSetupStep("ready")
    setError(null)
  }, [])

  const load = useCallback(async () => {
    if (!enabled) return
    setStatus("loading")
    setError(null)
    setSetupStep("preparing")
    try {
      setSetupStep("course")
      const ctx = await fetchFacultyCoraContext()
      const course = ctx.context?.course
      setCourseTitle(course?.courseTitle ?? null)
      setCourseCode(course?.courseCode ?? null)
      setSetupStep("chats")
      setSetupStep("playbook")
      const nextPlaybook = ctx.context?.playbook ?? null
      setPlaybook(nextPlaybook)
      if (nextPlaybook?.insights?.length) {
        setInsights(nextPlaybook.insights)
      } else {
        try {
          const insightRes = await fetchFacultyCoraInsights()
          setInsights(insightRes.insights ?? [])
        } catch {
          setInsights([])
        }
      }
      setSetupStep("ready")
      setStatus("ready")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to load Cora Copilot")
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (status !== "loading") return
    const timer = window.setTimeout(() => {
      setStatus("error")
      setError("Setup is taking longer than expected. You can continue without full context or retry.")
    }, 45_000)
    return () => window.clearTimeout(timer)
  }, [status])

  const capabilities = useMemo<FacultyCoraCapability[]>(
    () => applyFacultyCoraPlaybook(FACULTY_CORA_CAPABILITIES, playbook),
    [playbook],
  )

  return {
    status,
    setupStep,
    error,
    courseTitle,
    courseCode,
    insights,
    capabilities,
    retrySetup: load,
    skipSetup,
  }
}
