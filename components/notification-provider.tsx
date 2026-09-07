"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type NotificationVariant = "default" | "destructive" | "success"

export interface Notification {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  variant?: NotificationVariant
  duration?: number
  createdAt: number
}

interface NotificationContextValue {
  notify: (opts: Omit<Notification, "id" | "createdAt">) => string
  dismiss: (id?: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const MAX_VISIBLE = 5
const DEFAULT_DURATION = 3000

let idCounter = 0
function genId() {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER
  return `notif-${idCounter}`
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    setMounted(true)
  }, [])

  const dismiss = useCallback((id?: string) => {
    if (id) {
      const t = timersRef.current.get(id)
      if (t) clearTimeout(t)
      timersRef.current.delete(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
    } else {
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current.clear()
      setItems([])
    }
  }, [])

  const notify = useCallback(
    (opts: Omit<Notification, "id" | "createdAt">) => {
      const id = genId()
      const duration = opts.duration ?? DEFAULT_DURATION
      const notification: Notification = {
        ...opts,
        id,
        createdAt: Date.now(),
      }
      setItems((prev) => [...prev, notification].slice(-MAX_VISIBLE))

      if (duration > 0) {
        const t = setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, t)
      }
      return id
    },
    [dismiss]
  )

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      {mounted &&
        typeof document !== "undefined" &&
        document.body &&
        createPortal(
          <div
            className="fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[420px] pointer-events-none"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 pointer-events-auto">
              {items.map((n) => (
                <NotificationItem key={n.id} item={n} onDismiss={() => dismiss(n.id)} />
              ))}
            </div>
          </div>,
          document.body
        )}
    </NotificationContext.Provider>
  )
}

function NotificationItem({
  item,
  onDismiss,
}: {
  item: Notification
  onDismiss: () => void
}) {
  const variant = item.variant ?? "default"
  return (
    <div
      role="alert"
      className={cn(
        "group relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-xl border p-4 pr-10",
        "shadow-xl shadow-black/10 dark:shadow-black/40 ring-1 ring-black/5 dark:ring-white/10",
        "animate-in slide-in-from-right-full duration-300 backdrop-blur-md",
        variant === "destructive" &&
          "border-red-200/80 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-950/70 dark:text-red-100",
        variant === "success" &&
          "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/70 dark:text-emerald-100",
        variant === "default" &&
          "border-slate-200/80 bg-white text-slate-900 dark:border-slate-600/80 dark:bg-slate-800 dark:text-slate-100"
      )}
    >
      <div className="grid gap-1 min-w-0 flex-1">
        <p className="text-sm font-semibold text-inherit">{item.title}</p>
        {item.description && (
          <p className="text-sm opacity-90 text-inherit">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-lg p-1.5 opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useNotification() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider")
  }
  return {
    notify: ctx.notify,
    dismiss: ctx.dismiss,
    toast: (opts: { title: React.ReactNode; description?: React.ReactNode; variant?: NotificationVariant }) =>
      ctx.notify(opts),
  }
}
