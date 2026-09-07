import { lazy, Suspense, type ComponentType } from 'react'

type DynamicOptions = {
  loading?: () => React.ReactNode
  ssr?: boolean
}

type Loader<T extends ComponentType<unknown>> = () => Promise<{ default: T } | T>

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
    return (
      <Suspense fallback={options?.loading?.() ?? null}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}
