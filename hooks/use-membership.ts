"use client"

import { useEffect, useState } from "react"
import { type MembershipTier, getQuizAttemptsLimit, getAITutorAccess } from "@/lib/membership-utils"

export function useMembership() {
  const [tier, setTier] = useState<MembershipTier>("Scholar")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedTier = sessionStorage.getItem("studentMembershipTier") as MembershipTier
    setTier(storedTier || "Scholar")
    setLoading(false)
  }, [])

  return {
    tier,
    loading,
    quizAttemptsLimit: getQuizAttemptsLimit(tier),
    aiTutorAccess: getAITutorAccess(tier),
  }
}
