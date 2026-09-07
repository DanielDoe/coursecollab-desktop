"use client"

import { useState, type ReactNode } from "react"
import { CampImageLightbox } from "@/components/summer-camp/CampImageLightbox"
import { cn } from "@/lib/utils"

type CampZoomableImageProps = {
  src?: string | null
  alt?: string
  className?: string
  imgClassName?: string
  zoomable?: boolean
  caption?: string
  children?: ReactNode
}

/** Optional click-to-expand lightbox — no hover mask or overlay chrome. */
export function CampZoomableImage({
  src,
  alt = "",
  className,
  imgClassName,
  zoomable = true,
  caption,
  children,
}: CampZoomableImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const url = src?.trim() ?? ""

  if (!url) {
    return children ? <div className={className}>{children}</div> : null
  }

  const imageNode =
    children ??
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={alt} className={imgClassName} loading="lazy" />
    )

  if (!zoomable) {
    return <div className={className}>{imageNode}</div>
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          setLightboxOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setLightboxOpen(true)
          }
        }}
        className={cn(
          "relative block h-full w-full cursor-zoom-in text-left",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
          className,
        )}
        aria-label={alt ? `View larger: ${alt}` : "View larger image"}
      >
        {imageNode}
      </div>
      <CampImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        src={url}
        alt={alt}
        caption={caption}
      />
    </>
  )
}
