"use client"

import * as React from "react"
import type { Variants } from "framer-motion"

import { motion } from "@/components/landing/framer"
import { fadeUp, LANDING_VIEWPORT } from "@/components/landing/landing-motion"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"

type LandingRevealProps = {
  children: React.ReactNode
  className?: string
  variants?: Variants
  as?: keyof typeof motion
}

export function LandingReveal({
  children,
  className,
  variants = fadeUp,
  as = "div",
}: LandingRevealProps) {
  const effectsEnabled = useLandingMotionEnabled()
  const Component = motion[as] as typeof motion.div

  if (!effectsEnabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <Component
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={LANDING_VIEWPORT}
    >
      {children}
    </Component>
  )
}
