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

export function redirect(_url: string): never {
  throw new Error('redirect() is not supported in the Vite desktop shell')
}

export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND')
}

export function permanentRedirect(_url: string): never {
  throw new Error('permanentRedirect() is not supported in the Vite desktop shell')
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
