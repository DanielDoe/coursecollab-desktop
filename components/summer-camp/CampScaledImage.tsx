"use client"

import { cn } from "@/lib/utils"
import { ImageIcon } from "lucide-react"
import { CampZoomableImage } from "@/components/summer-camp/CampZoomableImage"

type CampScaledImageProps = {
  src?: string | null
  alt?: string
  placeholder?: string
  aspectClass?: string
  className?: string
  imgClassName?: string
  zoomable?: boolean
}

/** Responsive image frame — placeholders keep aspect ratio; uploads fill with object-cover. */
export function CampScaledImage({
  src,
  alt = "",
  placeholder = "Image",
  aspectClass = "aspect-[4/3]",
  className,
  imgClassName,
  zoomable = true,
}: CampScaledImageProps) {
  const hasSrc = Boolean(src?.trim())

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/80",
        aspectClass,
        className,
      )}
    >
      {hasSrc ? (
        <CampZoomableImage
          src={src}
          alt={alt}
          zoomable={zoomable}
          className="absolute inset-0 h-full w-full"
          imgClassName={cn(
            "absolute inset-0 h-full w-full object-cover object-center",
            imgClassName,
          )}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
          <ImageIcon className="h-6 w-6 opacity-50" aria-hidden />
          <span className="text-[10px] font-medium sm:text-xs">{placeholder}</span>
        </div>
      )}
    </div>
  )
}
