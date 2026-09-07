import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  PORTAL_SOLID_DANGER,
  PORTAL_SOLID_QUIET,
  PORTAL_SOLID_SUCCESS,
  PORTAL_SOLID_THEME,
} from "@/lib/appearance/portal-nav-classes"

export function isCampContentPublished(status: string) {
  return status === "published"
}

export function campContentStatusLabel(status: string) {
  if (status === "published") return "Published"
  if (status === "unpublished") return "Unpublished"
  if (status === "draft") return "Draft"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function campStatusButtonClass(status: string, className?: string) {
  const published = isCampContentPublished(status)
  return cn(
    "inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold pointer-events-none",
    published ? PORTAL_SOLID_SUCCESS : PORTAL_SOLID_QUIET,
    className,
  )
}

export function CampStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={campStatusButtonClass(status, className)} aria-label={`Status: ${campContentStatusLabel(status)}`}>
      {campContentStatusLabel(status)}
    </span>
  )
}

export function TrainingPublishActions({
  status,
  onPublish,
  onUnpublish,
  publishLabel = "Publish",
  className,
}: {
  status: string
  onPublish: () => void
  onUnpublish?: () => void
  publishLabel?: string
  className?: string
}) {
  const published = isCampContentPublished(status)

  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-2", className)}>
      <CampStatusBadge status={status} />
      {published ? (
        onUnpublish ? (
          <Button size="sm" className={cn("h-8 rounded-lg", PORTAL_SOLID_DANGER)} onClick={onUnpublish}>
            Unpublish
          </Button>
        ) : null
      ) : (
        <Button size="sm" className={cn("h-8 rounded-lg", PORTAL_SOLID_THEME)} onClick={onPublish}>
          {publishLabel}
        </Button>
      )}
    </div>
  )
}
