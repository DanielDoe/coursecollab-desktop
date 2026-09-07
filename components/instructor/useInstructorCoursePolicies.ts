"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import type { CoursePoliciesBundle } from "@/lib/course-policy-settings"
import {
  defaultCoursePoliciesBundle,
  parseAttendancePolicy,
  parseProjectPolicy,
  parseRewardsPolicy,
} from "@/lib/course-policy-settings"

export function useInstructorCoursePolicies() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policies, setPolicies] = useState<CoursePoliciesBundle>(defaultCoursePoliciesBundle())
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load policies")
      setPolicies({
        attendance_policy: parseAttendancePolicy(data.attendance_policy),
        rewards_policy: parseRewardsPolicy(data.rewards_policy),
        project_policy: parseProjectPolicy(data.project_policy),
      })
      setUpdatedAt(data.updated_at ?? null)
    } catch (e) {
      toast({
        title: "Could not load policies",
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

  const save = async (patch: Partial<CoursePoliciesBundle>) => {
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        method: "PATCH",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setPolicies({
        attendance_policy: parseAttendancePolicy(data.attendance_policy),
        rewards_policy: parseRewardsPolicy(data.rewards_policy),
        project_policy: parseProjectPolicy(data.project_policy),
      })
      toast({ title: "Policy saved", description: "Course policy updated for this offering." })
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

  return { policies, setPolicies, loading, saving, save, reload: load, updatedAt }
}
