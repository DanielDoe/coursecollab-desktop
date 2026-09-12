import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { NotificationProvider } from '@/components/notification-provider'
import { AppConfirmProvider } from '@/components/providers/app-confirm-provider'
import { AppQueryProvider } from '@/components/providers/app-query-provider'
import { UserTimezoneProvider } from '@/components/providers/user-timezone-provider'
import { SessionCatalogProvider } from '@/components/session-catalog-provider'
import { DesktopNotificationBridge } from '@/components/desktop/DesktopNotificationBridge'
import { NativeWebBridgeListener } from '@/components/native-web-bridge-listener'
import { SystemErrorBoundary } from '@/components/system-error-boundary'
import { SessionExpiryGuard } from '@/components/auth/SessionExpiryGuard'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { DEFAULT_USER_TIMEZONE, USER_TIMEZONE_COOKIE, normalizeTimezone } from '@/lib/user-timezone'
import '@/lib/console-override'
import '@/app/globals.css'

function readTimezoneCookie(): string {
  if (typeof document === 'undefined') return DEFAULT_USER_TIMEZONE
  const match = document.cookie.match(new RegExp(`(?:^|; )${USER_TIMEZONE_COOKIE}=([^;]*)`))
  if (!match?.[1]) return DEFAULT_USER_TIMEZONE
  try {
    return normalizeTimezone(decodeURIComponent(match[1]))
  } catch {
    return normalizeTimezone(match[1])
  }
}

function markDesktopShell() {
  window.__COURSE_COLLAB_DESKTOP__ = true
  document.documentElement.dataset.desktopApp = 'true'
  document.body.classList.add('cc-desktop-app')
}

export function RootLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const initialTimezone = useMemo(() => readTimezoneCookie(), [])
  const errorBoundaryResetKeys = useMemo(
    () => [location.pathname, location.search] as const,
    [location.pathname, location.search],
  )

  if (typeof window !== "undefined") {
    markDesktopShell()
  }

  useEffect(() => {
    markDesktopShell()
  }, [])

  return (
    <div className="font-sans antialiased min-h-[100dvh]">
      <SessionExpiryGuard />
      <ThemeProvider>
        <AppConfirmProvider>
          <AppQueryProvider>
            <UserTimezoneProvider initialTimezone={initialTimezone}>
              <NotificationProvider>
                <DesktopNotificationBridge />
                <NativeWebBridgeListener />
                <SessionCatalogProvider>
                  <SystemErrorBoundary
                    moduleName="Platform Module"
                    resetKeys={errorBoundaryResetKeys}
                  >
                    {children}
                  </SystemErrorBoundary>
                </SessionCatalogProvider>
              </NotificationProvider>
            </UserTimezoneProvider>
          </AppQueryProvider>
        </AppConfirmProvider>
      </ThemeProvider>
      <Toaster />
      <SonnerToaster />
    </div>
  )
}
