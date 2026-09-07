"use client"

import * as React from "react"
import { LazyMotion, domAnimation } from "framer-motion"

import { useLandingEffectsEnabled } from "@/hooks/use-landing-effects-enabled"

const LandingEffectsContext = React.createContext(false)

export function useLandingMotionEnabled() {
  return React.useContext(LandingEffectsContext)
}

export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  const effectsEnabled = useLandingEffectsEnabled()

  return (
    <LazyMotion features={domAnimation} strict>
      <LandingEffectsContext.Provider value={effectsEnabled}>{children}</LandingEffectsContext.Provider>
    </LazyMotion>
  )
}
