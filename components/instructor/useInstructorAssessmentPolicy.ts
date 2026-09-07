"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  DEFAULT_ASSESSMENT_POLICY,
  parseAssessmentPolicy,
  type AssessmentPolicy,
} from "@/lib/assessment-policy-settings"

export function useInstructorAssessmentPolicy() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<AssessmentPolicy>(DEFAULT_ASSESSMENT_POLICY)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load assessment defaults")
      setPolicy(parseAssessmentPolicy(data.assessment_policy))
      setUpdatedAt(data.updated_at ?? null)
    } catch (e) {
      toast({
        title: "Could not load assessment defaults",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const save = async (next?: AssessmentPolicy) => {
    setSaving(true)
    try {
      const payload = next ?? policy
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        method: "PATCH",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ assessment_policy: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setPolicy(parseAssessmentPolicy(data.assessment_policy))
      toast({
        title: "Assessment defaults saved",
        description: "New assessments inherit these settings unless overridden per assessment.",
      })
      return true
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const resetToPlatformDefaults = () => {
    setPolicy(structuredClone(DEFAULT_ASSESSMENT_POLICY))
  }

  return { policy, setPolicy, loading, saving, save, reload: load, updatedAt, resetToPlatformDefaults }
}
