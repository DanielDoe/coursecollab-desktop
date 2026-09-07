"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuestionTypeSelector } from "@/components/question-bank/question-type-selector"
import { QuestionBankCreateTypePanel } from "@/components/question-bank/question-bank-create-type-panel"
import type { CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"

export function QuestionBankAddTypeSheet({
  open,
  onOpenChange,
  bankBase,
  onTypeSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankBase: string
  onTypeSaved: () => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"browse" | "create">("browse")
  const [customTypes, setCustomTypes] = useState<CustomQuestionTypeDraft[]>([])
  const [pickedType, setPickedType] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    instructorApiFetch("/api/instructor/question-bank/custom-types", {
      headers: getInstructorScopeHeaders() as Record<string, string>,
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.types)) setCustomTypes(d.types)
      })
      .catch(() => {})
  }, [open])

  function reset() {
    setTab("browse")
    setPickedType(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function useType(typeId: string) {
    handleOpenChange(false)
    router.push(`${bankBase}/new?type=${encodeURIComponent(typeId)}`)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
        <SheetHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
          <SheetTitle className={PORTAL_TEXT}>Question types</SheetTitle>
          <SheetDescription className={PORTAL_TEXT_MUTED}>
            Pick a built-in or saved type, or describe a new format for AI to generate a schema and UI.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "browse" | "create")}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mx-5 mt-4 grid w-auto grid-cols-2 !bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 shadow-none">
            <TabsTrigger
              value="browse"
              className={cn(
                "rounded-lg text-sm data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:!text-white",
              )}
            >
              Browse types
            </TabsTrigger>
            <TabsTrigger
              value="create"
              className={cn(
                "rounded-lg text-sm data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:!text-white",
              )}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Create with AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="min-h-0 flex-1 overflow-y-auto px-5 py-4 mt-0">
            <QuestionTypeSelector
              value={pickedType}
              onChange={setPickedType}
              customTypes={customTypes}
              onCreateNewType={() => setTab("create")}
            />
            {pickedType ? (
              <div className="sticky bottom-0 mt-4 border-t border-[var(--border)] bg-[var(--card)] pt-4">
                <Button
                  type="button"
                  className="w-full bg-[var(--cc-accent)] text-white hover:opacity-90"
                  onClick={() => useType(pickedType)}
                >
                  Create question with this type
                </Button>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="create" className="min-h-0 flex-1 overflow-y-auto px-5 py-4 mt-0">
            <QuestionBankCreateTypePanel
              onCancel={() => setTab("browse")}
              onSaved={(type) => {
                setCustomTypes((prev) => {
                  const rest = prev.filter((t) => t.typeId !== type.typeId)
                  return [...rest, type]
                })
                onTypeSaved()
                useType(type.typeId)
              }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
