"use client"

import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion"
import { Children, isValidElement, type ReactElement, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  createAuthRoutePushVariants,
  routeTransitionTiming,
  type RouteTransitionDirection,
} from "@/src/router/route-transition"

export const desktopAuthEase = [0.22, 1, 0.36, 1] as const

export const desktopAuthDurations = {
  page: 0.34,
  panel: 0.28,
  item: 0.24,
  quick: 0.18,
} as const

export function useDesktopAuthMotion() {
  const reduceMotion = useReducedMotion()
  return {
    reduceMotion: Boolean(reduceMotion),
    page: reduceMotion ? { duration: 0 } : { duration: desktopAuthDurations.page, ease: desktopAuthEase },
    panel: reduceMotion ? { duration: 0 } : { duration: desktopAuthDurations.panel, ease: desktopAuthEase },
    item: reduceMotion ? { duration: 0 } : { duration: desktopAuthDurations.item, ease: desktopAuthEase },
  }
}

export const desktopAuthFadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export const desktopAuthFadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const desktopAuthSlideIn: Variants = {
  hidden: { opacity: 0, x: 18 },
  visible: { opacity: 1, x: 0 },
}

export const desktopAuthStaggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
}

type DesktopAuthFadeUpProps = {
  children: ReactNode
  className?: string
  variant?: "fadeUp" | "fadeIn" | "slideIn"
} & Omit<HTMLMotionProps<"div">, "children">

export function DesktopAuthFadeUp({
  children,
  className,
  variant = "fadeUp",
  ...props
}: DesktopAuthFadeUpProps) {
  const { item, reduceMotion } = useDesktopAuthMotion()
  const variants =
    variant === "fadeIn" ? desktopAuthFadeIn : variant === "slideIn" ? desktopAuthSlideIn : desktopAuthFadeUp

  return (
    <motion.div
      className={className}
      variants={variants}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      transition={item}
      {...props}
    >
      {children}
    </motion.div>
  )
}

type DesktopAuthStaggerProps = {
  children: ReactNode
  className?: string
}

export function DesktopAuthStagger({ children, className }: DesktopAuthStaggerProps) {
  const { panel, reduceMotion } = useDesktopAuthMotion()

  return (
    <motion.div
      className={className}
      variants={desktopAuthStaggerContainer}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      transition={panel}
    >
      {Children.map(Children.toArray(children), (child, index) => {
        if (!isValidElement(child)) return child
        const keyed = child as ReactElement<{ className?: string }>
        return (
          <motion.div key={keyed.key ?? index} variants={desktopAuthFadeUp} transition={panel}>
            {child}
          </motion.div>
        )
      })}
    </motion.div>
  )
}

type DesktopAuthPageEnterProps = {
  children: ReactNode
  className?: string
  routeKey?: string
}

/** Enter animation for the right pane when auth routes change. */
export function DesktopAuthPageEnter({ children, className, routeKey }: DesktopAuthPageEnterProps) {
  const reduceMotion = Boolean(useReducedMotion())
  const pushVariants = createAuthRoutePushVariants(reduceMotion)
  const direction: RouteTransitionDirection = "forward"

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={routeKey}
        custom={direction}
        className={cn("flex min-h-0 flex-1 flex-col", className)}
        variants={pushVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={reduceMotion ? { duration: 0 } : routeTransitionTiming}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

type DesktopAuthFormSwitchProps = {
  switchKey: string
  children: ReactNode
  className?: string
}

/** Cross-fade / push between login modes or wizard steps. */
export function DesktopAuthFormSwitch({ switchKey, children, className }: DesktopAuthFormSwitchProps) {
  const reduceMotion = Boolean(useReducedMotion())
  const pushVariants = createAuthRoutePushVariants(reduceMotion)
  const direction: RouteTransitionDirection = "forward"

  return (
    <motion.div
      key={switchKey}
      custom={direction}
      className={className}
      variants={pushVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={reduceMotion ? { duration: 0 } : { ...routeTransitionTiming, duration: 0.28 }}
    >
      {children}
    </motion.div>
  )
}
