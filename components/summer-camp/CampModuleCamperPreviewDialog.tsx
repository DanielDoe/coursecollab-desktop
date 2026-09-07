"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CampBlockRenderer } from "@/components/summer-camp/CampBlockRenderer"
import {
  CampCollapsibleModuleSection,
  CampModuleSectionsToolbar,
} from "@/components/summer-camp/CampCollapsibleModuleSection"
import {
  layoutModuleBlocks,
  shouldOmitLeadingSectionHeading,
} from "@/lib/summer-camp/group-module-blocks"
import type { CampModuleBlock } from "@/lib/summer-camp/types"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduleTitle: string
  trainingTitle?: string
  blocks: CampModuleBlock[]
}

export function CampModuleCamperPreviewDialog({
  open,
  onOpenChange,
  moduleTitle,
  trainingTitle,
  blocks,
}: Props) {
  const layoutItems = useMemo(() => layoutModuleBlocks(blocks), [blocks])

  const sectionGroups = useMemo(
    () =>
      layoutItems
        .filter((item) => item.type === "section")
        .map((item) => item.group),
    [layoutItems],
  )

  const sectionIndexByGroupId = useMemo(() => {
    const map = new Map<string, number>()
    sectionGroups.forEach((group, index) => map.set(group.id, index))
    return map
  }, [sectionGroups])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const [allSectionsExpanded, setAllSectionsExpanded] = useState(true)

  useEffect(() => {
    if (!open) return
    setOpenSections(Object.fromEntries(sectionGroups.map((group) => [group.id, true])))
    setAllSectionsExpanded(true)
  }, [open, sectionGroups])

  const toggleAllSections = () => {
    const next = !allSectionsExpanded
    setAllSectionsExpanded(next)
    setOpenSections(Object.fromEntries(sectionGroups.map((group) => [group.id, next])))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex flex-col gap-0 p-0 w-[min(98vw,88rem)] max-w-none h-[min(94vh,960px)] translate-y-[-50%] sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 sm:px-6 py-4 text-left space-y-2">
          <div className="flex items-start gap-2 pr-8">
            <Eye className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl leading-snug">{moduleTitle}</DialogTitle>
              {trainingTitle ? (
                <DialogDescription className="mt-1">{trainingTitle}</DialogDescription>
              ) : null}
            </div>
          </div>
          <p className="text-xs rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200 px-3 py-2">
            Camper preview — read-only. Progress, uploads, and discussions are disabled. This is how
            published blocks render for students.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-5 sm:py-6">
          <div className="space-y-4 w-full max-w-none">
            {sectionGroups.length > 0 ? (
              <CampModuleSectionsToolbar
                sectionCount={sectionGroups.length}
                allExpanded={allSectionsExpanded}
                onToggleAll={toggleAllSections}
              />
            ) : null}

            {layoutItems.map((item) => {
              if (item.type === "knowledge_check") {
                return (
                  <div key={`kc-${item.block.id}`} className="py-1">
                    <CampBlockRenderer block={item.block} readOnly />
                  </div>
                )
              }

              const group = item.group
              return (
                <CampCollapsibleModuleSection
                  key={group.id}
                  title={group.title}
                  sectionIndex={sectionIndexByGroupId.get(group.id) ?? 0}
                  blockCount={group.blocks.length}
                  open={openSections[group.id]}
                  onOpenChange={(nextOpen) => {
                    setOpenSections((prev) => ({ ...prev, [group.id]: nextOpen }))
                    if (!nextOpen) setAllSectionsExpanded(false)
                  }}
                >
                  {group.blocks.map((block, blockIndex) => (
                    <CampBlockRenderer
                      key={block.id}
                      block={block}
                      readOnly
                      omitLeadingSectionHeading={shouldOmitLeadingSectionHeading(
                        block,
                        group.title,
                      )}
                    />
                  ))}
                </CampCollapsibleModuleSection>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
