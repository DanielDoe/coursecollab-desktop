import { createContext, useContext, useMemo } from 'react'
import {
  useNavigate,
  useLocation,
  useSearchParams as useRouterSearchParams,
  useParams as useRouterParams,
} from 'react-router-dom'

export const RouteParamsContext = createContext<Record<string, string>>({})

export function useRouter() {
  const navigate = useNavigate()

  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => window.location.reload(),
      prefetch: async () => {},
    }),
    [navigate],
  )
}

export function usePathname() {
  return useLocation().pathname
}

export function useSearchParams() {
  const [params] = useRouterSearchParams()
  return params
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
  const routerParams = useRouterParams()
  const routeParams = useContext(RouteParamsContext)
  return { ...routeParams, ...routerParams } as T
}

function navigateDesktopRedirect(url: string): void {
  if (typeof window === 'undefined') return

  queueMicrotask(() => {
    try {
      const target = new URL(url, window.location.href)
      const next = `${target.pathname}${target.search}${target.hash}`
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (next === current) return
      window.history.replaceState(null, '', next)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch {
      window.location.replace(url)
    }
  })
}

/** Next.js-style redirect; in the Vite shell we navigate then throw NEXT_REDIRECT (ignored by the error boundary). */
export function redirect(url: string): never {
  navigateDesktopRedirect(url)
  const err = new Error(`NEXT_REDIRECT:${url}`)
  ;(err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`
  throw err
}

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND')
}

export function permanentRedirect(url: string): never {
  navigateDesktopRedirect(url)
  const err = new Error(`NEXT_REDIRECT:${url}`)
  ;(err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};308;`
  throw err
}

export function useSelectedLayoutSegment(_parallelRouteKey?: string): string | null {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  return segments.at(-1) ?? null
}

export function useSelectedLayoutSegments(): string[] {
  return usePathname().split('/').filter(Boolean)
}

export function useServerInsertedHTML(_callback: () => unknown): void {
  /* no-op in client-only shell */
}
