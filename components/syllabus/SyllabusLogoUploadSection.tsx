"use client"

import { useRef, useState } from "react"
import { Building2, Loader2, Upload, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { SYLLABUS_DROPZONE, SYLLABUS_DROPZONE_ACTIVE } from "@/lib/syllabus/syllabus-surface-classes"
import { SYLLABUS_IMAGE_ACCEPT } from "@/components/syllabus/SyllabusSectionImageUpload"
import { questionMediaDisplayUrl } from "@/lib/question-media-proxy"

type SyllabusLogoUploadSectionProps = {
  logoUrl?: string | null
  logoFileName?: string | null
  fallbackLogoUrl?: string
  universityName?: string
  primaryColor?: string
  secondaryColor?: string
  uploading?: boolean
  onUpload: (file: File) => Promise<void>
  onRemove?: () => Promise<void>
}

export function SyllabusLogoUploadSection({
  logoUrl,
  logoFileName,
  fallbackLogoUrl,
  universityName,
  primaryColor,
  secondaryColor,
  uploading = false,
  onUpload,
  onRemove,
}: SyllabusLogoUploadSectionProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const rawDisplayUrl = logoUrl || fallbackLogoUrl
  const displayUrl = rawDisplayUrl
    ? questionMediaDisplayUrl(rawDisplayUrl) || rawDisplayUrl
    : undefined
  const hasCustomLogo = Boolean(logoUrl)

  const pickFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return
    await onUpload(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-4">
      <div className={cn(PORTAL_CARD, "space-y-4 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={chrome.iconBadge("sm")}>
              <Building2 className="h-4 w-4 !text-white" />
            </div>
            <div>
              <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Logo & branding</p>
              <p className={cn("mt-0.5 max-w-xl text-xs", PORTAL_TEXT_MUTED)}>
                Shown at the top of the student syllabus. A custom upload replaces the university default.
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={cn("rounded-lg text-[11px]", hasCustomLogo ? chrome.success : chrome.quiet)}
          >
            {hasCustomLogo ? "Custom logo" : "University default"}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl bg-[var(--muted)] p-5">
            {displayUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayUrl}
                  alt="Syllabus header logo preview"
                  className="h-auto max-h-28 w-full object-contain"
                />
                {logoFileName ? (
                  <p className={cn("mt-3 text-center text-xs", PORTAL_TEXT_MUTED)}>{logoFileName}</p>
                ) : null}
              </>
            ) : (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No logo available</p>
            )}
          </div>

          <div className="space-y-3 rounded-xl bg-[var(--muted)] p-4">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              University identity
            </p>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
              {universityName || "CourseCollab"}
            </p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              Header colors stay with the university brand. The logo above is what students see first.
            </p>
            {primaryColor || secondaryColor ? (
              <div className="flex flex-wrap items-center gap-2">
                {primaryColor ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-xs">
                    <span
                      className="size-4 rounded-full ring-1 ring-[var(--border)]"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className={PORTAL_TEXT}>Primary</span>
                  </span>
                ) : null}
                {secondaryColor ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--card)] px-2.5 py-1.5 text-xs">
                    <span
                      className="size-4 rounded-full ring-1 ring-[var(--border)]"
                      style={{ backgroundColor: secondaryColor }}
                    />
                    <span className={PORTAL_TEXT}>Secondary</span>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

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
              <p className="text-sm">Uploading logo…</p>
            </div>
          ) : (
            <>
              <div className={cn("mx-auto mb-3", chrome.iconBadge("sm"))}>
                <Upload className="h-4 w-4 !text-white" />
              </div>
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                {hasCustomLogo ? "Drop a new image to replace the custom logo" : "Drag and drop a logo image"}
              </p>
              <Button
                type="button"
                size="sm"
                className={cn("mt-3 rounded-lg", chrome.solid)}
                onClick={() => inputRef.current?.click()}
              >
                {hasCustomLogo ? "Replace logo" : "Choose logo image"}
              </Button>
              <p className={cn("mt-2 text-xs", PORTAL_TEXT_MUTED)}>PNG or JPG recommended · max 5 MB</p>
            </>
          )}
        </div>

        {hasCustomLogo && onRemove ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              className={cn("rounded-lg", chrome.danger)}
              onClick={() => void onRemove()}
            >
              <X className="h-4 w-4" />
              Remove custom logo
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
