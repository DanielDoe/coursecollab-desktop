"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_USER_TIMEZONE,
  getDeviceTimezone,
  setDisplayTimezone,
} from "@/lib/user-timezone"

type UserTimezoneContextValue = {
  timezone: string
  refreshDeviceTimezone: () => void
}

const UserTimezoneContext = createContext<UserTimezoneContextValue | null>(null)

export function UserTimezoneProvider({
  children,
  initialTimezone = DEFAULT_USER_TIMEZONE,
}: {
  children: ReactNode
  initialTimezone?: string
}) {
  const [timezone, setTimezoneState] = useState(initialTimezone)

  const refreshDeviceTimezone = useCallback(() => {
    const deviceTz = setDisplayTimezone(getDeviceTimezone())
    setTimezoneState(deviceTz)
  }, [])

  useEffect(() => {
    refreshDeviceTimezone()
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshDeviceTimezone()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refreshDeviceTimezone])

  const value = useMemo(
    () => ({ timezone, refreshDeviceTimezone }),
    [timezone, refreshDeviceTimezone],
  )

  return <UserTimezoneContext.Provider value={value}>{children}</UserTimezoneContext.Provider>
}

export function useUserTimezone() {
  const ctx = useContext(UserTimezoneContext)
  if (!ctx) {
    throw new Error("useUserTimezone must be used within UserTimezoneProvider")
  }
  return ctx
}

export function useUserTimezoneOptional() {
  return useContext(UserTimezoneContext)
}
