"use client"

import { useState, useEffect } from "react"

const LG_BREAKPOINT = 1024

export function useIsLg() {
  const [isLg, setIsLg] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT}px)`)
    const onChange = () => setIsLg(window.innerWidth >= LG_BREAKPOINT)
    mql.addEventListener("change", onChange)
    setIsLg(window.innerWidth >= LG_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isLg
}
