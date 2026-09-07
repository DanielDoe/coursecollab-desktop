"use client"

import { useEffect, useState } from "react"

interface BetaUser {
  isBetaUser: boolean
  userId: string | null
  loading: boolean
}

interface FeatureFlag {
  flag_name: string
  description: string
  enabled_for_beta: boolean
  enabled_for_all: boolean
  module: string
}

interface FeatureFlagsResponse {
  isBetaUser: boolean
  flags: FeatureFlag[]
  allFlags: FeatureFlag[]
}

export function useBeta() {
  const [betaUser, setBetaUser] = useState<BetaUser>({
    isBetaUser: false,
    userId: null,
    loading: true
  })

  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsResponse>({
    isBetaUser: false,
    flags: [],
    allFlags: []
  })

  useEffect(() => {
    // Get user ID from session storage or localStorage
    const userId = sessionStorage.getItem("studentId") || localStorage.getItem("studentId")
    
    if (userId) {
      setBetaUser(prev => ({ ...prev, userId, loading: false }))
      fetchFeatureFlags(userId)
    } else {
      setBetaUser(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const fetchFeatureFlags = async (userId: string) => {
    try {
      const response = await fetch(`/api/feature-flags?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setFeatureFlags(data)
        setBetaUser(prev => ({ ...prev, isBetaUser: data.isBetaUser }))
      }
    } catch (error) {
      console.error("Failed to fetch feature flags:", error)
    }
  }

  const isFeatureEnabled = (flagName: string): boolean => {
    return featureFlags.flags.some(flag => flag.flag_name === flagName)
  }

  const getFeatureFlag = (flagName: string): FeatureFlag | undefined => {
    return featureFlags.flags.find(flag => flag.flag_name === flagName)
  }

  const refreshFeatureFlags = () => {
    if (betaUser.userId) {
      fetchFeatureFlags(betaUser.userId)
    }
  }

  return {
    ...betaUser,
    featureFlags: featureFlags.flags,
    allFeatureFlags: featureFlags.allFlags,
    isFeatureEnabled,
    getFeatureFlag,
    refreshFeatureFlags
  }
}
