import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { cn } from "@/lib/utils"

export function PageLoading({
  label = "Loading",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[70vh] flex-col items-center justify-center gap-5 bg-[var(--cc-background,#faf8fc)] px-4",
        className,
      )}
    >
      <CcBookLoader size="lg" label={label} />
      <p className="text-sm font-medium text-[var(--cc-text-secondary,#57534e)]">{label}</p>
    </div>
  )
}
