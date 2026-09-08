import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { rememberDesktopRoute } from '@/lib/desktop-session-resume'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { RootLayout } from './RootLayout'
import { AppRoute, DesktopRedirect } from './router/AppRoute'
import {
  createAuthRoutePushVariants,
  isDesktopAuthRoute,
  routeTransitionTiming,
  useAuthRouteTransitionDirection,
  type RouteTransitionDirection,
} from './router/route-transition'

type AuthAnimatedRoutesProps = {
  location: Location
  direction: RouteTransitionDirection
  reduceMotion: boolean
}

function AuthAnimatedRoutes({ location, direction, reduceMotion }: AuthAnimatedRoutesProps) {
  const pushVariants = createAuthRoutePushVariants(reduceMotion)

  return (
    <motion.div
      custom={direction}
      variants={pushVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={reduceMotion ? { duration: 0 } : routeTransitionTiming}
      data-auth-route-pane
      className="relative z-10 min-h-[100dvh] w-full will-change-transform"
    >
      <Routes location={location}>
        <Route path="/" element={<DesktopRedirect />} />
        <Route path="/*" element={<AppRoute />} />
      </Routes>
    </motion.div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const reduceMotion = Boolean(useReducedMotion())
  const authRoute = isDesktopAuthRoute(location.pathname)
  const direction = useAuthRouteTransitionDirection()

  useEffect(() => {
    rememberDesktopRoute(`${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  // Auth-only slide transitions. Dashboard modules (CodeBench, Trade Center, etc.)
  // render through the plain Routes branch below — no AnimatePresence overlay stack.
  if (!authRoute) {
    return (
      <Routes location={location}>
        <Route path="/" element={<DesktopRedirect />} />
        <Route path="/*" element={<AppRoute />} />
      </Routes>
    )
  }

  return (
    <div className="cc-auth-route-shell relative min-h-[100dvh] overflow-x-clip bg-[var(--cc-background)]">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <AuthAnimatedRoutes
          key={location.pathname + location.search}
          location={location}
          direction={direction}
          reduceMotion={reduceMotion}
        />
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RootLayout>
        <AppRoutes />
      </RootLayout>
    </BrowserRouter>
  )
}
