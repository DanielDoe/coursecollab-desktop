import { useCallback, useEffect, useRef } from "react"

/** Debounce a callback; call `flush()` to run immediately. */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delayMs: number,
): T & { flush: () => void } {
  const fnRef = useRef(fn)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const argsRef = useRef<Parameters<T> | null>(null)

  fnRef.current = fn

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (argsRef.current) {
      fnRef.current(...argsRef.current)
      argsRef.current = null
    }
  }, [])

  useEffect(() => () => flush(), [flush])

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      argsRef.current = args
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (argsRef.current) {
          fnRef.current(...argsRef.current)
          argsRef.current = null
        }
      }, delayMs)
    },
    [delayMs],
  ) as T & { flush: () => void }

  debounced.flush = flush
  return debounced
}
