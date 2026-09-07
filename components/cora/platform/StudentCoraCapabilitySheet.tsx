"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { coraCapabilityIcon } from "@/components/cora/platform/CoraCapabilityCard"
import type { StudentCoraCapability } from "@/lib/cora/student-capabilities"
import { CORA_NAME } from "@/lib/cora/constants"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

type Props = {
  open: boolean
  capability: StudentCoraCapability | null
  thumb: SolidListThumb
  cta: SolidListThumb
  onClose: () => void
  onStart: (capability: StudentCoraCapability, prompt?: string) => void
  onResume?: (capability: StudentCoraCapability) => void
  canResume?: boolean
}

export function StudentCoraCapabilitySheet({
  open,
  capability,
  thumb,
  cta,
  onClose,
  onStart,
  onResume,
  canResume = false,
}: Props) {
  if (!capability) return null

  const Icon = coraCapabilityIcon(capability.id)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <SolidListThumbTile thumb={thumb} icon={Icon} size="list" />
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>{capability.title}</DialogTitle>
              <DialogDescription>
                {capability.description || `Start a ${CORA_NAME} conversation with a focused prompt.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl border-0"
            onClick={() => onStart(capability)}
            style={{ backgroundColor: cta.fill, color: cta.icon }}
          >
            Start new chat
          </Button>
          {canResume && onResume ? (
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onResume(capability)}>
              Resume last chat
            </Button>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Example prompts
          </p>
          {capability.examplePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onStart(capability, prompt)}
              className="block w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2.5 text-left text-sm text-[var(--cc-text)] transition-all hover:-translate-y-px"
              style={{
                boxShadow: "none",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.borderColor = `color-mix(in srgb, ${thumb.fill} 55%, transparent)`
                event.currentTarget.style.backgroundColor = `color-mix(in srgb, ${thumb.fill} 12%, transparent)`
                event.currentTarget.style.boxShadow = `0 6px 16px -8px ${thumb.fill}66`
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.borderColor = ""
                event.currentTarget.style.backgroundColor = ""
                event.currentTarget.style.boxShadow = "none"
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
