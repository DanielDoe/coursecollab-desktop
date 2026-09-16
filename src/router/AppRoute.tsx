import { Suspense, lazy, useMemo, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { useLocation, Navigate, Link } from 'react-router-dom'
import { ModulePageSkeleton } from '@/components/student/dashboard-v2/ModulePageSkeleton'
import { RouteParamsContext } from '@/src/shims/next-navigation'
import {
  defaultDesktopPath,
  extractRouteParams,
  getLayoutLoader,
  getPageLoader,
  resolveDesktopPathname,
  resolveLayoutChain,
  resolvePageModule,
} from './page-resolver'

function LoadingFallback() {
  return <ModulePageSkeleton className="min-h-[280px]" />
}

function RouteModuleShell({ children }: { children: ReactNode }) {
  return (
    <div data-route-module-shell className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {children}
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-[#F8FAFC] dark:bg-slate-950 px-6 text-center">
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Page not found</p>
      <p className="text-sm text-slate-500 max-w-md">
        This route is not available in the desktop shell yet, or your last session pointed at a page
        that was removed.
      </p>
      <Link
        to={defaultDesktopPath()}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        Back to sign in
      </Link>
    </div>
  )
}

const lazyComponentCache = new Map<string, LazyExoticComponent<ComponentType>>()

function getLazyComponent(
  cacheKey: string,
  loader: () => Promise<{ default: ComponentType }>,
): LazyExoticComponent<ComponentType> {
  const cached = lazyComponentCache.get(cacheKey)
  if (cached) return cached

  const created = lazy(loader)
  lazyComponentCache.set(cacheKey, created)
  return created
}

function nestLayouts(
  layouts: string[],
  page: ReactNode,
  index: number,
): ReactNode {
  if (index >= layouts.length) return page

  const layoutPath = layouts[index]
  const loader = getLayoutLoader(layoutPath)
  if (!loader) return nestLayouts(layouts, page, index + 1)

  const Layout = getLazyComponent(
    layoutPath,
    loader as () => Promise<{ default: ComponentType<{ children: ReactNode }> }>,
  )
  return (
    <Suspense key={layoutPath} fallback={<LoadingFallback />}>
      <Layout>{nestLayouts(layouts, page, index + 1)}</Layout>
    </Suspense>
  )
}

export function DesktopRedirect() {
  return <Navigate to={defaultDesktopPath()} replace />
}

export function AppRoute() {
  const location = useLocation()
  const pathname = location.pathname

  const pageModule = useMemo(() => resolvePageModule(pathname), [pathname])
  const layoutChain = useMemo(() => resolveLayoutChain(pathname), [pathname])
  const routeParams = useMemo(() => {
    if (!pageModule) return {}
    const resolvedPath = resolveDesktopPathname(pathname)
    return extractRouteParams(pageModule, resolvedPath)
  }, [pageModule, pathname])

  const Page = useMemo(() => {
    if (!pageModule) return null
    const pageLoader = getPageLoader(pageModule)
    if (!pageLoader) return null
    return getLazyComponent(pageModule, pageLoader as () => Promise<{ default: ComponentType }>)
  }, [pageModule])

  if (!pageModule || !Page) {
    if (pathname !== defaultDesktopPath()) {
      return <Navigate to={defaultDesktopPath()} replace />
    }
    return <NotFound />
  }

  const page = (
    <RouteModuleShell>
      <Suspense key={pageModule} fallback={<LoadingFallback />}>
        <Page params={Promise.resolve(routeParams)} />
      </Suspense>
    </RouteModuleShell>
  )

  return (
    <RouteParamsContext.Provider value={routeParams}>
      {nestLayouts(layoutChain, page, 0)}
    </RouteParamsContext.Provider>
  )
}
