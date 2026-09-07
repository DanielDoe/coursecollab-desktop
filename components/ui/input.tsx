import type * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none md:text-sm",
        "bg-[var(--card)] text-[var(--cc-text)] border-[var(--border)]",
        "placeholder:text-[var(--cc-text-muted)]",
        "selection:bg-[var(--cc-sem-primary-soft)] selection:text-[var(--cc-text)]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--cc-text)]",
        "focus-visible:border-[var(--cc-sem-primary)] focus-visible:ring-[var(--cc-sem-primary-glow)] focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--muted)]",
        "aria-invalid:border-[var(--cc-sem-danger)] aria-invalid:ring-[var(--cc-sem-danger-glow)] aria-invalid:ring-[3px]",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
