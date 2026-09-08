import { lazy, Suspense, type ComponentType } from 'react'
import { ModulePageSkeleton } from '@/components/student/dashboard-v2/ModulePageSkeleton'

type DynamicOptions = {
  loading?: () => React.ReactNode
  ssr?: boolean
}

type Loader<T extends ComponentType<unknown>> = () => Promise<{ default: T } | T>

function defaultLoadingFallback() {
  return <ModulePageSkeleton className="min-h-[280px]" />
}

export default function dynamic<T extends ComponentType<unknown>>(
  loader: Loader<T>,
  options?: DynamicOptions,
) {
  const LazyComponent = lazy(async () => {
    const mod = await loader()
    if (typeof mod === 'function') {
      return { default: mod as T }
    }
    if ('default' in mod) {
      return mod as { default: T }
    }
    return { default: mod as unknown as T }
  })

  return function DynamicComponent(props: React.ComponentProps<T>) {
    const fallback = options?.loading ? options.loading() : defaultLoadingFallback()
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}
