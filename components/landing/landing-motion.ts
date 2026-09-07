import type { Variants } from "framer-motion"

export const LANDING_EASE = [0.22, 1, 0.36, 1] as const

export const LANDING_VIEWPORT = { once: true, margin: "-40px" } as const

export const sectionHeader: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: LANDING_EASE },
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: LANDING_EASE },
  },
}

export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: LANDING_EASE },
  },
}

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: LANDING_EASE },
  },
}

export const scalePop: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.38, ease: LANDING_EASE },
  },
}
