const pageModules = import.meta.glob('../../app/**/page.tsx')
const layoutModules = import.meta.glob('../../app/**/layout.tsx')

function modulePathToRoute(modulePath: string): string {
  return modulePath.replace('../../app', '').replace('/page.tsx', '').replace('/layout.tsx', '')
}

function trimTrailingSlash(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/'
}

type PathRule = {
  test: (path: string) => boolean
  to: (path: string) => string
}

/** Mirrors next.config.mjs redirects + rewrites for the Vite desktop shell. */
const desktopRedirectRules: PathRule[] = [
  { test: (p) => p === '/instructor/login', to: () => '/faculty/login' },
  { test: (p) => p === '/instructor/select-course', to: () => '/faculty/select-course' },
  {
    test: (p) => p === '/instructor/dashboard-v2/course-info/syllabus',
    to: () => '/instructor/dashboard-v2/content/syllabus',
  },
  { test: (p) => p === '/instructor/dashboard-v2', to: () => '/faculty/dashboard' },
  {
    test: (p) => p.startsWith('/instructor/dashboard-v2/'),
    to: (p) => p.replace('/instructor/dashboard-v2', '/faculty/dashboard'),
  },
  { test: (p) => p === '/instructor/dashboard', to: () => '/faculty/dashboard' },
  {
    test: (p) => p === '/instructor/ai-monitoring',
    to: () => '/faculty/dashboard/analytics/ai-monitoring',
  },
  { test: (p) => p === '/instructor/grades', to: () => '/faculty/dashboard/assessments/grades' },
  {
    test: (p) => p === '/instructor/ai-insights',
    to: () => '/faculty/dashboard/analytics/ai-insights',
  },
  {
    test: (p) => p === '/instructor/issues',
    to: () => '/faculty/dashboard/assessments/quizzes/issues',
  },
  {
    test: (p) => p === '/faculty/dashboard/course-info/syllabus',
    to: () => '/faculty/dashboard/content/syllabus',
  },
]

function applyDesktopRedirects(path: string): string {
  let next = path
  let guard = 0

  while (guard < 8) {
    guard += 1
    const rule = desktopRedirectRules.find((entry) => entry.test(next))
    if (!rule) break
    const resolved = trimTrailingSlash(rule.to(next))
    if (resolved === next) break
    next = resolved
  }

  return next
}

function applyDesktopRewrites(path: string): string {
  if (path === '/faculty/dashboard') return '/instructor/dashboard-v2'
  if (path.startsWith('/faculty/dashboard/')) {
    return path.replace('/faculty/dashboard', '/instructor/dashboard-v2')
  }
  return path
}

export function resolveDesktopPathname(pathname: string): string {
  const normalized = trimTrailingSlash(pathname)
  if (normalized === '/') return normalized
  return applyDesktopRewrites(applyDesktopRedirects(normalized))
}

function matchRoutePattern(routePath: string, pathname: string): boolean {
  const routeSegments = routePath.split('/').filter(Boolean)
  const pathSegments = pathname.split('/').filter(Boolean)
  if (routeSegments.length !== pathSegments.length) return false

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i]
    const pathSegment = pathSegments[i]
    if (routeSegment.startsWith('[') && routeSegment.endsWith(']')) continue
    if (routeSegment !== pathSegment) return false
  }

  return true
}

/** Prefer literal segments over dynamic ones so e.g. /student/results/[id] wins over /student/[assessmentType]/[id]. */
function routeSpecificity(routePath: string): number {
  return routePath
    .split('/')
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('[') && segment.endsWith(']')))
    .length
}

export function resolvePageModule(pathname: string): string | null {
  const path = resolveDesktopPathname(pathname)
  if (path === '/') return null

  const direct = `../../app${path}/page.tsx`
  if (pageModules[direct]) return direct

  let bestMatch: string | null = null
  let bestScore = -1

  for (const key of Object.keys(pageModules)) {
    const routePath = modulePathToRoute(key)
    if (!matchRoutePattern(routePath, path)) continue
    const score = routeSpecificity(routePath)
    if (score > bestScore) {
      bestScore = score
      bestMatch = key
    }
  }

  return bestMatch
}

export function resolveLayoutChain(pathname: string): string[] {
  const path = resolveDesktopPathname(pathname)
  const matches: { prefix: string; key: string }[] = []

  for (const key of Object.keys(layoutModules)) {
    const layoutPath = modulePathToRoute(key)
    if (!layoutPath) continue
    if (path === layoutPath || path.startsWith(`${layoutPath}/`)) {
      matches.push({ prefix: layoutPath, key })
    }
  }

  matches.sort((a, b) => a.prefix.length - b.prefix.length)
  return matches.map((match) => match.key)
}

export function extractRouteParams(modulePath: string, pathname: string): Record<string, string> {
  const routePath = modulePathToRoute(modulePath)
  const routeSegments = routePath.split('/').filter(Boolean)
  const pathSegments = pathname.replace(/\/$/, '').split('/').filter(Boolean)
  const params: Record<string, string> = {}

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i]
    if (routeSegment.startsWith('[') && routeSegment.endsWith(']')) {
      const name = routeSegment.slice(1, -1)
      params[name] = pathSegments[i] ?? ''
    }
  }

  return params
}

export function getPageLoader(modulePath: string) {
  return pageModules[modulePath]
}

export function getLayoutLoader(modulePath: string) {
  return layoutModules[modulePath]
}

export function defaultDesktopPath(): string {
  return '/auth/welcome'
}

/** Warm the Vite chunk for a desktop route before navigation (sidebar hover / focus). */
export function prefetchPageModule(pathname: string): void {
  const modulePath = resolvePageModule(pathname)
  if (!modulePath) return
  const loader = getPageLoader(modulePath)
  if (!loader) return
  void loader()
}
