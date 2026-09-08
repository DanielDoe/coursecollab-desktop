import { useMemo, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import type { Transition, Variants } from 'framer-motion'

export type RouteTransitionDirection = 'forward' | 'back' | 'none'

export const routeTransitionEase = [0.32, 0.72, 0, 1] as const

export const routeTransitionTiming: Transition = {
  duration: 0.36,
  ease: routeTransitionEase,
}

const AUTH_ROUTE_DEPTH_RULES: Array<{ test: (path: string) => boolean; depth: number }> = [
  { test: (path) => path === '/auth/welcome' || path === '/auth', depth: 0 },
  { test: (path) => path.startsWith('/auth/university'), depth: 10 },
  { test: (path) => path === '/auth/login-type', depth: 10 },
  {
    test: (path) => path.startsWith('/auth/access-') || path.startsWith('/auth/verify-access'),
    depth: 15,
  },
  { test: (path) => path.startsWith('/auth/student/signup'), depth: 18 },
  { test: (path) => path.startsWith('/auth/student/select-course'), depth: 25 },
  { test: (path) => path.startsWith('/auth/student'), depth: 20 },
  { test: (path) => path.startsWith('/auth/theme'), depth: 22 },
  { test: (path) => path.startsWith('/faculty/login'), depth: 20 },
  { test: (path) => path === '/admin/login', depth: 20 },
  { test: (path) => path.startsWith('/student/login/guest'), depth: 20 },
  { test: (path) => path.startsWith('/student/login/summer-camp'), depth: 20 },
]

export function getAuthRouteDepth(pathname: string): number {
  for (const rule of AUTH_ROUTE_DEPTH_RULES) {
    if (rule.test(pathname)) return rule.depth
  }
  return 40
}

export function isDesktopAuthRoute(pathname: string) {
  return (
    pathname.startsWith('/auth') ||
    pathname === '/faculty/login' ||
    pathname === '/admin/login' ||
    pathname.startsWith('/student/login/guest') ||
    pathname.startsWith('/student/login/summer-camp')
  )
}

export function resolveRouteTransitionDirection(
  pathname: string,
  previousPathname: string,
  navigationType: ReturnType<typeof useNavigationType>,
): RouteTransitionDirection {
  if (navigationType === 'REPLACE') return 'none'
  if (navigationType === 'POP') return 'back'

  const previousDepth = getAuthRouteDepth(previousPathname)
  const currentDepth = getAuthRouteDepth(pathname)

  if (currentDepth > previousDepth) return 'forward'
  if (currentDepth < previousDepth) return 'back'
  if (pathname !== previousPathname) return 'forward'
  return 'none'
}

export function useAuthRouteTransitionDirection(): RouteTransitionDirection {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const previousPathnameRef = useRef(pathname)

  const direction = useMemo(
    () =>
      resolveRouteTransitionDirection(pathname, previousPathnameRef.current, navigationType),
    [pathname, navigationType],
  )

  previousPathnameRef.current = pathname

  return direction
}

export function createAuthRoutePushVariants(reduceMotion: boolean): Variants {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, x: 0, pointerEvents: 'auto' },
      exit: { opacity: 0, pointerEvents: 'none' },
    }
  }

  return {
    initial: (direction: RouteTransitionDirection) => ({
      x: direction === 'back' ? '-18%' : direction === 'forward' ? '18%' : 0,
      opacity: direction === 'none' ? 0 : 0.92,
    }),
    animate: {
      x: 0,
      opacity: 1,
      pointerEvents: 'auto',
    },
    exit: (direction: RouteTransitionDirection) => ({
      x: direction === 'back' ? '10%' : direction === 'forward' ? '-10%' : 0,
      opacity: direction === 'none' ? 0 : 0.88,
      // Exiting auth panes are full-viewport; without this, popLayout keeps them
      // pointer-active and they eat clicks/typing on the incoming login form.
      pointerEvents: 'none',
    }),
  }
}
