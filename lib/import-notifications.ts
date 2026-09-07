import { toast } from "@/components/ui/use-toast"

export function showImportProcessingToast(count: number) {
  console.log("[v0] showImportProcessingToast called with count:", count)

  const toastResult = toast({
    title: "⏳ Processing Import...",
    description: `Importing ${count} question${count !== 1 ? "s" : ""}. This may take a moment.`,
    duration: Number.POSITIVE_INFINITY, // Don't auto-dismiss
  })

  console.log("[v0] Processing toast created:", toastResult)
  return toastResult
}

export function showImportStatusToast({
  imported,
  skipped,
  failed,
}: {
  imported: number
  skipped: number
  failed: number
}) {
  console.log("[v0] showImportStatusToast called with:", { imported, skipped, failed })

  const total = imported + skipped + failed
  const allSuccess = imported === total && failed === 0
  const allFailed = failed === total && imported === 0

  console.log("[v0] Toast status - allSuccess:", allSuccess, "allFailed:", allFailed)

  let title = "Import Complete"
  let variant: "default" | "destructive" = "default"
  let icon = "✅"

  if (allSuccess) {
    title = "🎉 Import Successful!"
    icon = "🎉"
  } else if (allFailed) {
    title = "❌ Import Failed"
    variant = "destructive"
    icon = "❌"
  } else if (failed > 0) {
    title = "⚠️ Import Completed with Issues"
    icon = "⚠️"
  }

  const statusParts = []
  if (imported > 0) statusParts.push(`✅ Imported: ${imported}`)
  if (skipped > 0) statusParts.push(`⚠️ Skipped: ${skipped}`)
  if (failed > 0) statusParts.push(`❌ Failed: ${failed}`)

  const description = statusParts.join(" | ")

  console.log("[v0] Creating toast with title:", title, "description:", description, "variant:", variant)

  const toastResult = toast({
    title,
    description,
    variant,
    duration: 5000,
    className: allSuccess ? "border-green-500 bg-green-50 dark:bg-green-950" : allFailed ? "border-red-500" : "",
  })

  console.log("[v0] Status toast created:", toastResult)
  return toastResult
}
