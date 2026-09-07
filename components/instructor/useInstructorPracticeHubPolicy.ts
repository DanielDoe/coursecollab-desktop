"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  DEFAULT_PRACTICE_HUB_POLICY,
  parsePracticeHubPolicy,
  type PracticeHubPolicy,
} from "@/lib/practice-hub-policy-settings"

export function useInstructorPracticeHubPolicy() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<PracticeHubPolicy>({ ...DEFAULT_PRACTICE_HUB_POLICY })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load practice hub policy")
      setPolicy(parsePracticeHubPolicy(data.practice_hub_policy))
    } catch (e) {
      toast({
        title: "Could not load practice rules",
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

  const save = async (patch?: Partial<PracticeHubPolicy>) => {
    setSaving(true)
    try {
      const payload = patch ? { ...policy, ...patch } : policy
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        method: "PATCH",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ practice_hub_policy: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setPolicy(parsePracticeHubPolicy(data.practice_hub_policy))
      toast({ title: "Practice rules saved", description: "Course Practice Hub policy updated." })
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

  return { policy, setPolicy, loading, saving, save, reload: load }
}
