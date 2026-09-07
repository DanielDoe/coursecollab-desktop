"use client"

import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAGNIFIC } from "@/lib/appearance/magnific-shell"

type ShellCreateButtonProps = {
  collapsed: boolean
  onClick: () => void
  label?: string
}

export function ShellCreateButton({
  collapsed,
  onClick,
  label = "Create",
}: ShellCreateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: MAGNIFIC.pink }}
      className={cn(
        "mb-4 flex items-center justify-center gap-2 font-semibold text-white transition-colors hover:opacity-90",
        collapsed ? "mx-auto size-10 rounded-xl p-0" : "mx-2.5 h-10 w-[calc(100%-1.25rem)] rounded-xl text-[14px]",
      )}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = MAGNIFIC.pinkHover
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = MAGNIFIC.pink
      }}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <Plus className={cn("shrink-0 text-white", collapsed ? "size-5" : "size-4")} strokeWidth={2.5} />
      {!collapsed ? <span>{label}</span> : null}
    </button>
  )
}
