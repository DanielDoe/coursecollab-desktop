"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * A hook that persists state to sessionStorage so it survives navigation
 * Perfect for maintaining UI state like active tabs, scroll positions, etc.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  storage: "session" | "local" = "session"
): [T, (value: T | ((prev: T) => T)) => void] {
  // Get the storage object based on type
  const getStorage = useCallback(() => {
    if (typeof window === "undefined") return null
    return storage === "session" ? sessionStorage : localStorage
  }, [storage])

  // Initialize state from storage or default value
  const [state, setState] = useState<T>(() => {
    try {
      const storageObj = getStorage()
      if (!storageObj) return defaultValue

      const item = storageObj.getItem(key)
      return item ? (JSON.parse(item) as T) : defaultValue
    } catch (error) {
      console.warn(`Error reading ${key} from ${storage}Storage:`, error)
      return defaultValue
    }
  })

  // Update storage whenever state changes
  useEffect(() => {
    try {
      const storageObj = getStorage()
      if (!storageObj) return

      storageObj.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.warn(`Error writing ${key} to ${storage}Storage:`, error)
    }
  }, [key, state, storage, getStorage])

  // Enhanced setState that supports both direct values and updater functions
  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(prev => {
      const newValue = value instanceof Function ? value(prev) : value
      return newValue
    })
  }, [])

  return [state, setPersistedState]
}

/**
 * Hook to persist scroll position
 */
export function useScrollRestoration(key: string) {
  useEffect(() => {
    // Restore scroll position on mount
    const savedPosition = sessionStorage.getItem(`scroll-${key}`)
    if (savedPosition) {
      const position = parseInt(savedPosition, 10)
      window.scrollTo(0, position)
    }

    // Save scroll position on unmount or before navigation
    const saveScrollPosition = () => {
      sessionStorage.setItem(`scroll-${key}`, window.scrollY.toString())
    }

    window.addEventListener("beforeunload", saveScrollPosition)
    
    // Save on navigation (for SPA)
    const handleRouteChange = () => {
      saveScrollPosition()
    }

    // Listen for route changes if using Next.js router
    return () => {
      saveScrollPosition()
      window.removeEventListener("beforeunload", saveScrollPosition)
    }
  }, [key])
}

/**
 * Hook to clear persisted state for a specific page
 */
export function useClearPersistedState(keys: string[]) {
  return useCallback(() => {
    keys.forEach(key => {
      sessionStorage.removeItem(key)
      sessionStorage.removeItem(`scroll-${key}`)
    })
  }, [keys])
}

