"use client"

import { useRef, useState } from "react"
import { BookImage, Loader2, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  SYLLABUS_DROPZONE,
  SYLLABUS_DROPZONE_ACTIVE,
  SYLLABUS_TILE,
  SYLLABUS_VALUE,
  PORTAL_TEXT_MUTED,
} from "@/lib/syllabus/syllabus-surface-classes"

export const SYLLABUS_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"

type SyllabusSectionImageUploadProps = {
  imageUrl?: string | null
  imageFileName?: string | null
  imageCaption?: string | null
  uploading?: boolean
  onUpload: (file: File, caption?: string) => Promise<void>
  onRemove?: () => Promise<void>
  onCaptionChange?: (caption: string) => void
  variant?: "textbook" | "instructor"
}

const VARIANT_COPY = {
  textbook: {
    title: "Textbook / materials image",
    description: "Upload a cover photo of the required textbook. Students will see it in the materials section.",
    badgeOn: "Image attached",
    badgeOff: "No image",
    captionLabel: "Image caption",
    captionPlaceholder: "e.g. Circuit Analysis and Design, 2nd Edition",
    defaultCaption: "Course textbook cover",
    previewClass: "mx-auto max-w-xs overflow-hidden rounded-xl bg-[var(--card)] ring-1 ring-[var(--border)]/50",
    previewImgClass: "h-auto w-full object-contain",
  },
  instructor: {
    title: "Instructor photo",
    description: "Upload a headshot or profile photo. If none is uploaded, students see initials as a default avatar.",
    badgeOn: "Photo uploaded",
    badgeOff: "Default avatar",
    captionLabel: "",
    captionPlaceholder: "",
    defaultCaption: "",
    previewClass:
      "mx-auto h-32 w-32 overflow-hidden rounded-full bg-[var(--card)] ring-2 ring-[var(--border)]/50",
    previewImgClass: "h-full w-full object-cover",
  },
} as const

export function SyllabusSectionImageUpload({
  imageUrl,
  imageFileName,
  imageCaption,
  uploading = false,
  onUpload,
  onRemove,
  onCaptionChange,
  variant = "textbook",
}: SyllabusSectionImageUploadProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const copy = VARIANT_COPY[variant]
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [caption, setCaption] = useState(imageCaption ?? copy.defaultCaption)

  const hasImage = Boolean(imageUrl)
  const showCaption = variant === "textbook"

  const pickFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return
    await onUpload(file, caption)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={cn(SYLLABUS_TILE, "space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={chrome.iconBadge("sm")}>
            <BookImage className="h-4 w-4 !text-white" />
          </div>
          <div>
            <p className={cn("text-sm font-semibold", SYLLABUS_VALUE)}>{copy.title}</p>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{copy.description}</p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn("rounded-lg text-[11px]", hasImage ? chrome.success : chrome.quiet)}
        >
          {hasImage ? copy.badgeOn : copy.badgeOff}
        </Badge>
      </div>

      {showCaption ? (
        <div className="space-y-2">
          <Label htmlFor="syllabus-image-caption">{copy.captionLabel}</Label>
          <Input
            id="syllabus-image-caption"
            value={caption}
            onChange={(e) => {
              setCaption(e.target.value)
              onCaptionChange?.(e.target.value)
            }}
            placeholder={copy.captionPlaceholder}
            className="rounded-lg border-0 bg-[var(--muted)] shadow-none"
          />
        </div>
      ) : null}

      <div
        className={cn(
          SYLLABUS_DROPZONE,
          dragActive && SYLLABUS_DROPZONE_ACTIVE,
          uploading && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          void pickFile(e.dataTransfer.files?.[0])
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={SYLLABUS_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
        {uploading ? (
          <div className={cn("flex flex-col items-center gap-2", PORTAL_TEXT_MUTED)}>
            <Loader2 className="h-7 w-7 animate-spin text-[var(--cc-accent)]" />
            <p className="text-sm">Uploading image…</p>
          </div>
        ) : (
          <>
            <div className={cn("mx-auto mb-3", chrome.iconBadge("sm"))}>
              <Upload className="h-4 w-4 !text-white" />
            </div>
            <p className={cn("text-sm font-medium", SYLLABUS_VALUE)}>Drag and drop an image</p>
            <Button
              type="button"
              size="sm"
              className={cn("mt-3 rounded-lg", chrome.solid)}
              onClick={() => inputRef.current?.click()}
            >
              Choose image
            </Button>
            <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>JPG, PNG, WebP, or GIF · max 10 MB</p>
          </>
        )}
      </div>

      {hasImage && imageUrl ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {imageFileName ? <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{imageFileName}</span> : null}
            {onRemove ? (
              <Button
                type="button"
                size="sm"
                className={cn("rounded-lg", chrome.danger)}
                onClick={() => void onRemove()}
              >
                <X className="h-4 w-4" />
                Remove image
              </Button>
            ) : null}
          </div>
          <div className={copy.previewClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={caption || copy.title} className={copy.previewImgClass} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
