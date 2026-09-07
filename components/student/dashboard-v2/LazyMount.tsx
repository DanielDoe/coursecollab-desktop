"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  minHeight?: number
  rootMargin?: string
  className?: string
}

/** Mount children only when near the viewport — cuts initial dashboard work. */
export function LazyMount({
  children,
  minHeight = 160,
  rootMargin = "240px 0px",
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold: 0.01 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  return (
    <div
      ref={ref}
      className={cn("min-w-0", className)}
      style={visible ? undefined : { minHeight }}
    >
      {visible ? children : null}
    </div>
  )
}
