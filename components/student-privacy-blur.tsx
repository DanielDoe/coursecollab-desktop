import { cn } from "@/lib/utils"
import { PRIVACY_PLACEHOLDER_NAME } from "@/lib/student-privacy"

interface PrivacyBlurProps {
  isCurrentUser: boolean
  children: React.ReactNode
  className?: string
  placeholder?: string
}

export function PrivacyBlur({
  isCurrentUser,
  children,
  className,
  placeholder = PRIVACY_PLACEHOLDER_NAME,
}: PrivacyBlurProps) {
  if (isCurrentUser) {
    return <>{children}</>
  }

  return (
    <div
      className={cn("blur-[6px] select-none pointer-events-none", className)}
      aria-hidden
    >
      <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
    </div>
  )
}

interface PrivacyHiddenPointsProps {
  isCurrentUser: boolean
  value: React.ReactNode
  className?: string
}

export function PrivacyHiddenPoints({ isCurrentUser, value, className }: PrivacyHiddenPointsProps) {
  if (isCurrentUser) {
    return <>{value}</>
  }

  return (
    <div
      className={cn(
        "inline-flex flex-col items-end gap-0.5 px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-400 blur-[6px] select-none pointer-events-none",
        className
      )}
      aria-hidden
    >
      <span className="text-xl font-bold">•••</span>
      <span className="text-xs opacity-90">hidden</span>
    </div>
  )
}
