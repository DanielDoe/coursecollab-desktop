"use client"

import { useEffect } from "react"
import { toast } from "@/lib/app-toast"

const DEMOS = [
  {
    variant: "success" as const,
    title: "Board deleted successfully",
    description: "'CEO Summary' has been deleted from your reports.",
    actionLabel: "Okay",
  },
  {
    variant: "error" as const,
    title: "Operation failed",
    description: "Failed to delete 'CEO Summary' board.",
    actionLabel: "Try again",
  },
  {
    variant: "info" as const,
    title: "Board Bearer",
    description: "Hurray! you've created more than 3 boards in a week.",
    actionLabel: "Okay",
  },
  {
    variant: "warning" as const,
    title: "Think outside the folder",
    description: "You've nested 3 folders already. Maximum limit reached.",
    actionLabel: "Okay",
  },
]

export default function AlertPreviewPage() {
  useEffect(() => {
    const demo = DEMOS[1]
    toast.error(demo.title, {
      description: demo.description,
      duration: 120_000,
      action: { label: demo.actionLabel, onClick: () => undefined },
    })
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold text-[var(--cc-text)]">Alert preview</h1>
      <p className="text-sm text-[var(--cc-text-muted)]">
        Light/dark card toasts with status icon + purple action. Toggle theme from any dashboard
        top bar.
      </p>
      <div className="flex flex-wrap gap-2">
        {DEMOS.map((demo) => (
          <button
            key={demo.variant}
            type="button"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--sidebar-accent)]/40"
            onClick={() =>
              toast[demo.variant](demo.title, {
                description: demo.description,
                duration: 120_000,
                action: { label: demo.actionLabel, onClick: () => undefined },
              })
            }
          >
            {demo.variant}
          </button>
        ))}
      </div>
    </div>
  )
}
