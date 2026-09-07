"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  DEFAULT_PLAYGROUND_POLICY,
  parsePlaygroundPolicy,
  type PlaygroundPolicy,
} from "@/lib/playground-policy-settings"

export function useInstructorPlaygroundPolicy() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<PlaygroundPolicy>({
    ...DEFAULT_PLAYGROUND_POLICY,
    default_allowed_session_ids: [],
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load playground policy")
      setPolicy(parsePlaygroundPolicy(data.playground_policy))
    } catch (e) {
      toast({
        title: "Could not load playground rules",
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

  const save = async (patch?: Partial<PlaygroundPolicy>) => {
    setSaving(true)
    try {
      const payload = patch ? { ...policy, ...patch } : policy
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        method: "PATCH",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ playground_policy: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setPolicy(parsePlaygroundPolicy(data.playground_policy))
      toast({ title: "Playground rules saved", description: "Course playground policy updated." })
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
