"use client"

import Link from "next/link"
import { ChevronRight, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  facultyCoraCapabilityThumb,
  type FacultyCoraCapability,
} from "@/lib/cora/faculty-capabilities"
import type { CoraChrome } from "@/lib/cora/cora-chrome-theme"
import { loadFacultyCoraPreferences } from "@/lib/cora/faculty-preferences-storage"
import { cn } from "@/lib/utils"

type Props = {
  capability: FacultyCoraCapability
  chrome: CoraChrome
  onAsk: (capability: FacultyCoraCapability, prompt?: string) => void
  children?: React.ReactNode
}

export function FacultyCoraCapabilityPanel({ capability, chrome, onAsk, children }: Props) {
  const Icon = capability.icon
  const thumb = facultyCoraCapabilityThumb(capability.id, chrome)
  const showRelatedModules = loadFacultyCoraPreferences().showRelatedModules

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
        <SolidListThumbTile thumb={thumb} icon={Icon} size="list" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--cc-text)]">{capability.title}</h2>
          <p className="text-sm text-[var(--cc-text-muted)]">{capability.tagline}</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-10 w-full shrink-0 rounded-xl border-0 sm:w-auto sm:inline-flex"
          style={{ backgroundColor: chrome.roles.cta.fill, color: chrome.roles.cta.icon }}
          onClick={() => onAsk(capability)}
        >
          Start chat
        </Button>
      </div>

      {capability.description ? (
        <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">{capability.description}</p>
      ) : null}

      <GroupedList label="Try asking">
        {capability.examplePrompts.length ? (
          capability.examplePrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onAsk(capability, prompt)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--muted)]/25"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: thumb.fill, color: thumb.icon }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 text-sm text-[var(--cc-text)]">{prompt}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={() => onAsk(capability)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm text-[var(--cc-text-muted)]"
          >
            Cora is still building prompts from the course scan. Open chat to ask anything.
            <ChevronRight className="ml-auto h-4 w-4 shrink-0" />
          </button>
        )}
      </GroupedList>

      {showRelatedModules && capability.relatedModules.length > 0 ? (
        <GroupedList label="Related modules">
          {capability.relatedModules.map((module) => {
            const ModuleIcon = module.icon
            return (
              <Link
                key={`${module.href}-${module.label}`}
                href={module.href}
                className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--muted)]/25"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--cc-text)]">
                  <ModuleIcon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-[var(--cc-text)]">{module.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
              </Link>
            )
          })}
        </GroupedList>
      ) : null}

      {children}
    </div>
  )
}

function GroupedList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
        {label}
      </p>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]",
          "divide-y divide-[var(--border)]",
        )}
      >
        {children}
      </div>
    </section>
  )
}
