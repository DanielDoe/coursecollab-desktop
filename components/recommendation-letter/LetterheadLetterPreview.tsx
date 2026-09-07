"use client"

import type { CSSProperties } from "react"
import Image from "next/image"
import type { RecommendationLetterheadContent } from "@/lib/recommendation-letterhead-types"
import {
  PVAMU_LETTERHEAD_ATTRIBUTION,
  PVAMU_LETTERHEAD_FOOTER_CONTACT_LINES,
  PVAMU_LETTERHEAD_FOOTER_WEB,
  PVAMU_LETTERHEAD_SYSTEM_LINE,
  PVAMU_LETTERHEAD_UNIVERSITY_TITLE,
} from "@/lib/recommendation-letterhead-types"
import {
  letterheadContentMarginPaddingPx,
  parseLetterheadContentMargin,
} from "@/lib/recommendation-letterhead-margin"
import {
  buildLetterheadClosingLines,
  clampLetterheadHeaderFontScale,
  clampLetterheadLogoTextGapPx,
  letterheadLogoBoxPx,
} from "@/lib/recommendation-letterhead-signatory"
import { cn } from "@/lib/utils"

function recipientSalutation(recipientName: string | null | undefined): string {
  const r = recipientName?.trim()
  if (!r) return "To Whom It May Concern:"
  const lower = r.toLowerCase()
  if (lower === "to whom it may concern" || lower === "to whom it may concern:") return "To Whom It May Concern:"
  if (lower.startsWith("dear ")) return r.endsWith(":") ? r : `${r}:`
  return `Dear ${r}${r.endsWith(":") ? "" : ":"}`
}

export type LetterheadLetterPreviewProps = {
  content: RecommendationLetterheadContent
  className?: string
}

/**
 * On-screen preview aligned with the official PVAMU ECE letterhead layout.
 */
export function LetterheadLetterPreview({ content, className }: LetterheadLetterPreviewProps) {
  const paragraphs = content.letterBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const logoPx = letterheadLogoBoxPx(content.logoScale ?? 1)
  const sigS = content.signatureScale ?? 1
  const sigW = Math.min(340, Math.round(220 * sigS))
  const sigH = Math.round(64 * sigS)
  const headerFs = clampLetterheadHeaderFontScale(content.headerFontScale)
  const headerGapPx = clampLetterheadLogoTextGapPx(content.headerLogoTextGapPx)
  const headerAlign = content.headerTextAlign ?? "left"
  const headerScaleVar = { ["--lh-header-scale" as string]: String(headerFs) } as CSSProperties

  const bodyFs = content.bodyFontScale ?? 1
  const bodyAlign = content.bodyTextAlign ?? "justify"
  const bodyAlignCls =
    bodyAlign === "left"
      ? "text-left"
      : bodyAlign === "center"
        ? "text-center"
        : bodyAlign === "right"
          ? "text-right"
          : "text-justify"
  const bodyScaleVar = { ["--lh-body-scale" as string]: String(bodyFs) } as CSSProperties

  const closing = buildLetterheadClosingLines({
    signatoryLine: content.instructorName,
    instructorTitle: content.instructorTitle,
    instructorEmail: content.instructorEmail,
    instructorPhone: content.instructorPhone,
    instructorOffice: content.instructorOffice,
    signatureBlock: content.signatureBlock,
  })

  const marginPreset = parseLetterheadContentMargin(content.contentMargin)
  const padXPx = letterheadContentMarginPaddingPx(marginPreset)
  const padYPx = Math.max(18, Math.round(padXPx * 0.88))

  return (
    <div
      data-letterhead-preview
      className={cn(
        "letterhead-paper-preview",
        "rounded-lg border border-neutral-200 bg-[#ffffff] text-[#171717]",
        "shadow-sm print:border-0 print:shadow-none",
        "[font-family:Georgia,'Times_New_Roman',Times,serif]",
        className,
      )}
      style={{ backgroundColor: "#ffffff", color: "#171717" }}
    >
      <div
        className="w-full max-w-[210mm] xl:max-w-none mx-auto xl:mx-0 min-h-[180mm] leading-snug"
        style={{
          paddingLeft: padXPx,
          paddingRight: padXPx,
          paddingTop: padYPx,
          paddingBottom: padYPx,
        }}
      >
        <header
          className={cn(
            "flex flex-col sm:flex-row sm:items-center",
            headerAlign === "center" && "items-center text-center gap-6",
          )}
          style={
            headerAlign === "center"
              ? ({ rowGap: "1.5rem" } as CSSProperties)
              : ({
                  columnGap: `${headerGapPx}px`,
                  rowGap: "1rem",
                } as CSSProperties)
          }
        >
          <div
            className={cn(
              "shrink-0 relative mx-auto sm:mx-0",
              headerAlign === "center" && "mx-auto",
            )}
            style={{ width: logoPx, height: logoPx }}
          >
            {content.logoUrl ? (
              <Image
                src={content.logoUrl}
                alt="University seal"
                fill
                className="object-contain object-center"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-center text-slate-400 px-2 leading-tight [font-family:ui-sans-serif,system-ui,sans-serif]">
                Logo / seal
              </div>
            )}
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 flex flex-col [font-family:ui-sans-serif,system-ui,sans-serif]",
              headerAlign === "left" && "items-start text-left",
              headerAlign === "center" && "items-center text-center max-w-xl mx-auto sm:mx-0 sm:max-w-none",
              headerAlign === "right" && "items-end text-right sm:items-end",
            )}
            style={headerScaleVar}
          >
            <p
              className={cn(
                "font-bold uppercase tracking-tight text-black leading-snug [font-family:Georgia,'Times_New_Roman',Times,serif]",
                "[font-size:calc(0.9375rem*var(--lh-header-scale))] sm:[font-size:calc(1.0625rem*var(--lh-header-scale))]",
              )}
            >
              {PVAMU_LETTERHEAD_UNIVERSITY_TITLE}
            </p>
            <p
              className={cn(
                "mt-1.5 italic text-neutral-900 leading-snug",
                "[font-size:calc(10px*var(--lh-header-scale))] sm:[font-size:calc(11px*var(--lh-header-scale))]",
              )}
            >
              {PVAMU_LETTERHEAD_SYSTEM_LINE}
            </p>
          </div>
        </header>

        <div className="mt-4 border-t border-neutral-300" aria-hidden />

        <div
          className={cn(
            "mt-6 sm:mt-8 space-y-4 text-neutral-900",
            "[font-size:calc(13px*var(--lh-body-scale))] sm:[font-size:calc(15px*var(--lh-body-scale))]",
            bodyAlignCls,
          )}
          style={bodyScaleVar}
        >
          <p>{content.date}</p>
          {content.recipientInsideAddressLines && content.recipientInsideAddressLines.length > 0 ? (
            <div className="space-y-0.5 mb-1 text-left">
              {content.recipientInsideAddressLines.map((line, i) => (
                <p key={`addr-${i}`} className="leading-snug">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <p className="font-semibold">{recipientSalutation(content.recipientName)}</p>
          {content.reLine?.trim() ? (
            <p className="opacity-95">{content.reLine.trim()}</p>
          ) : content.letterPurpose?.trim() ? (
            <p className="opacity-95">
              Re: Recommendation — {content.studentName} ({content.letterPurpose})
            </p>
          ) : null}
          <div className="space-y-3.5">
            {paragraphs.map((para, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {para}
              </p>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "mt-8 sm:mt-10 space-y-3 [font-size:calc(13px*var(--lh-body-scale))] sm:[font-size:calc(15px*var(--lh-body-scale))]",
            bodyAlignCls,
          )}
          style={bodyScaleVar}
        >
          <p>Sincerely,</p>
          {content.signatureUrl ? (
            <div
              className={cn(
                "relative",
                bodyAlign === "center" && "mx-auto",
                bodyAlign === "right" && "ml-auto",
              )}
              style={{ width: sigW, height: sigH }}
            >
              <Image
                src={content.signatureUrl}
                alt="Signature"
                fill
                className="object-contain object-left"
                unoptimized
              />
            </div>
          ) : (
            <div
              className={cn(
                "rounded border border-dashed border-slate-300 text-[9px] text-slate-400 flex items-center justify-center [font-family:ui-sans-serif,system-ui,sans-serif]",
                bodyAlign === "center" && "mx-auto",
                bodyAlign === "right" && "ml-auto",
              )}
              style={{ width: sigW, height: Math.max(40, sigH - 8) }}
            >
              Signature
            </div>
          )}
          <div className="space-y-0.5">
            <p className="font-bold">{content.instructorName}</p>
            {closing.map((line) => (
              <p key={line} className="text-neutral-900">
                {line}
              </p>
            ))}
          </div>
        </div>

        <footer className="mt-10 sm:mt-12 pt-3 border-t border-neutral-300 text-[10px] sm:text-[11px] [font-family:ui-sans-serif,system-ui,sans-serif]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[10px] sm:text-[11px] text-neutral-800">
            <p className="sm:self-center">{PVAMU_LETTERHEAD_FOOTER_WEB}</p>
            <div className="text-left sm:text-right space-y-0.5 leading-snug">
              {PVAMU_LETTERHEAD_FOOTER_CONTACT_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <p className="text-center text-[9px] text-neutral-400 mt-2.5">{PVAMU_LETTERHEAD_ATTRIBUTION}</p>
        </footer>
      </div>
    </div>
  )
}

export const LETTERHEAD_PREVIEW_SAMPLE: RecommendationLetterheadContent = {
  studentName: "Jordan Lee",
  recipientInsideAddressLines: ["Graduate Admissions", "College of Engineering", "123 Campus Way", "College Station, TX 77840"],
  recipientName: "Graduate Admissions Committee",
  letterPurpose: "Graduate school",
  date: new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" }),
  letterBody:
    "It is my pleasure to recommend Jordan Lee for graduate study in electrical engineering. In my course, Jordan consistently prepared thoroughly, contributed thoughtfully in discussion, and demonstrated strong analytical skills.\n\nJordan completed a substantial project involving embedded system design and documentation, meeting deadlines while maintaining high quality. Based on this experience, I recommend Jordan without reservation.",
  instructorName: "Daniel Mawunyo Doe, Ph.D.",
  instructorTitle: "Assistant Professor",
  instructorEmail: "dmdoe@pvamu.edu",
  instructorPhone: "936-261-9916",
  instructorOffice: "Electrical Engineering 326",
  logoUrl: null,
  signatureUrl: null,
  logoScale: 1,
  signatureScale: 1,
  headerFontScale: 0.92,
  headerTextAlign: "left",
  headerLogoTextGapPx: 20,
  contentMargin: "normal",
}
