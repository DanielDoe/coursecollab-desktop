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
import type { FacultyCoraCapability } from "@/lib/cora/faculty-capabilities"
import { FACULTY_CORA_NAV_LABEL } from "@/lib/cora/constants"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

type Props = {
  open: boolean
  capability: FacultyCoraCapability | null
  thumb: SolidListThumb
  cta: SolidListThumb
  onClose: () => void
  onStart: (capability: FacultyCoraCapability, prompt?: string) => void
}

export function FacultyCoraCapabilitySheet({
  open,
  capability,
  thumb,
  cta,
  onClose,
  onStart,
}: Props) {
  if (!capability) return null
  const Icon = capability.icon

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <SolidListThumbTile thumb={thumb} icon={Icon} size="list" />
            <div className="min-w-0 space-y-1.5">
              <DialogTitle>
                {capability.emoji} {capability.title}
              </DialogTitle>
              <DialogDescription>
                {capability.description || `Start a ${FACULTY_CORA_NAV_LABEL} conversation.`}
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
        </div>

        {capability.relatedModules.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold tracking-wide text-[var(--cc-text-muted)]">
              Related modules
            </p>
            <div className="flex flex-wrap gap-2">
              {capability.relatedModules.slice(0, 4).map((module) => (
                <Button key={module.href} asChild type="button" size="sm" variant="outline" className="rounded-xl">
                  <a href={module.href}>{module.label}</a>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-[var(--cc-text-muted)]">
            Example prompts
          </p>
          {capability.examplePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onStart(capability, prompt)}
              className="block w-full rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2.5 text-left text-sm text-[var(--cc-text)] transition-all hover:-translate-y-px"
            >
              {prompt}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
