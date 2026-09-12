"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

export type AppConfirmOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** Destructive styling for the confirm action (delete / end session / etc.). */
  variant?: "default" | "destructive"
}

export type AppAlertOptions = {
  title: string
  description: string
  confirmLabel?: string
}

type PendingDialog =
  | (AppConfirmOptions & { mode: "confirm"; resolve: (value: boolean) => void })
  | (AppAlertOptions & { mode: "alert"; resolve: (value: boolean) => void })

type AppConfirmApi = {
  /** Custom confirmation modal. Resolves `true` only when the user confirms. */
  confirm: (options: AppConfirmOptions) => Promise<boolean>
  /** Custom alert modal (single OK action). Always resolves `true` after dismiss. */
  alert: (options: AppAlertOptions) => Promise<void>
}

const AppConfirmContext = createContext<AppConfirmApi | null>(null)

export function AppConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null)
  const pendingRef = useRef<PendingDialog | null>(null)
  pendingRef.current = pending

  const closeWith = useCallback((value: boolean) => {
    const current = pendingRef.current
    if (!current) return
    setPending(null)
    current.resolve(value)
  }, [])

  const confirm = useCallback((options: AppConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ mode: "confirm", ...options, resolve })
    })
  }, [])

  const alert = useCallback((options: AppAlertOptions) => {
    return new Promise<void>((resolve) => {
      setPending({
        mode: "alert",
        ...options,
        resolve: () => resolve(),
      })
    })
  }, [])

  const api = useMemo(() => ({ confirm, alert }), [alert, confirm])

  const open = pending != null
  const isConfirm = pending?.mode === "confirm"
  const destructive = isConfirm && pending.variant === "destructive"

  return (
    <AppConfirmContext.Provider value={api}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeWith(false)
        }}
      >
        <AlertDialogContent className="rounded-xl sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-left leading-relaxed">
              {pending?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {isConfirm ? (
              <AlertDialogCancel onClick={() => closeWith(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </AlertDialogCancel>
            ) : null}
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                closeWith(true)
              }}
              className={cn(
                destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {pending?.confirmLabel ?? (isConfirm ? "Confirm" : "OK")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppConfirmContext.Provider>
  )
}

export function useAppConfirm(): AppConfirmApi {
  const ctx = useContext(AppConfirmContext)
  if (!ctx) {
    throw new Error("useAppConfirm must be used within AppConfirmProvider")
  }
  return ctx
}
