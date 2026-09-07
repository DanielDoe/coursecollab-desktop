"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useState } from "react"
import { useToast } from "@/hooks/use-toast"

function readInstructorId(): number | undefined {
  if (typeof window === "undefined") return undefined
  const raw = localStorage.getItem("instructorId")
  if (!raw) return undefined
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : undefined
}

export function useCourseEvaluationReview(onUpdated?: () => void) {
  const { toast } = useToast()
  const [acting, setActing] = useState(false)
  const [bulkActing, setBulkActing] = useState(false)

  const reviewOne = useCallback(
    async (id: number, action: "approve" | "reject", note?: string) => {
      setActing(true)
      try {
        const res = await instructorApiFetch("/api/instructor/course-evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            action,
            instructorId: readInstructorId(),
            note: note?.trim() || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed")

        toast({
          title: action === "approve" ? "Evaluation approved" : "Evaluation returned",
          description: data.message,
          variant: action === "approve" ? "success" : "default",
        })
        onUpdated?.()
        return true
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Try again",
          variant: "destructive",
        })
        return false
      } finally {
        setActing(false)
      }
    },
    [onUpdated, toast],
  )

  const approveAll = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return
      setBulkActing(true)
      let ok = 0
      let fail = 0
      const instructorId = readInstructorId()
      for (const id of ids) {
        try {
          const res = await instructorApiFetch("/api/instructor/course-evaluations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "approve", instructorId }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || "Failed")
          ok++
        } catch {
          fail++
        }
      }
      setBulkActing(false)
      if (ok > 0) {
        toast({
          title: `Approved ${ok} evaluation${ok === 1 ? "" : "s"}`,
          description: fail > 0 ? `${fail} could not be approved` : undefined,
          variant: "success",
        })
        onUpdated?.()
      } else {
        toast({
          title: "Approve all failed",
          description: "No evaluations were approved",
          variant: "destructive",
        })
      }
    },
    [onUpdated, toast],
  )

  return { acting, bulkActing, reviewOne, approveAll }
}
