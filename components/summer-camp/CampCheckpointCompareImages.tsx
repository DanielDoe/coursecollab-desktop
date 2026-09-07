"use client"

import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"

type CampCheckpointCompareImagesProps = {
  referenceImageUrl?: string | null
  referenceLabel?: string
  studentImageUrl?: string | null
  studentLabel?: string
  referencePlaceholder?: string
  studentPlaceholder?: string
}

/** Side-by-side camp demo vs student upload for checkpoint blocks. */
export function CampCheckpointCompareImages({
  referenceImageUrl,
  referenceLabel = "Camp demo",
  studentImageUrl,
  studentLabel = "Your upload",
  referencePlaceholder = "Reference screenshot",
  studentPlaceholder = "Your screenshot will appear here",
}: CampCheckpointCompareImagesProps) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Compare your work
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-violet-700 dark:text-violet-300">{referenceLabel}</p>
          <CampScaledImage
            src={referenceImageUrl}
            alt={referenceLabel}
            placeholder={referencePlaceholder}
            aspectClass="aspect-[4/3]"
            imgClassName="object-contain bg-white p-1 dark:bg-slate-900"
            className="border border-violet-500/20"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{studentLabel}</p>
          <CampScaledImage
            src={studentImageUrl}
            alt={studentLabel}
            placeholder={studentPlaceholder}
            aspectClass="aspect-[4/3]"
            imgClassName="object-contain bg-white p-1 dark:bg-slate-900"
            className="border border-emerald-500/20"
          />
        </div>
      </div>
    </div>
  )
}
