"use client"

import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import type { CampCertificateRenderData, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import {
  collegeHeaderLines,
  departmentHeaderLines,
  enabledSignatories,
  CERTIFICATE_SEAL_URL,
  CERTIFICATE_WATERMARK_OPACITY,
  CERTIFICATE_PREVIEW_SIG_HEIGHT_PX,
  formatCertificateFooterDate,
  isBlockEnabled,
  resolveSignatureScale,
  resolveSignatureOffsetY,
  signatureOffsetYToPreviewPercent,
} from "@/lib/summer-camp/certificate-template-utils"
import {
  SAMPLE_CERTIFICATE_VERIFICATION_CODE,
} from "@/lib/summer-camp/certificate-verification-url"
import { cn } from "@/lib/utils"

export type CampCertificatePreviewProps = {
  template: CampCertificateTemplate
  data: CampCertificateRenderData
  className?: string
}

export const SAMPLE_CERTIFICATE_DATA: CampCertificateRenderData = {
  studentName: "Student Name",
  trainingName: "AI & Edge Computing Summer Camp 2026",
  campName: "Summer Camp 2026",
  certificateNumber: "PVAMU-AI-2026-0001",
  verificationCode: SAMPLE_CERTIFICATE_VERIFICATION_CODE,
  verificationUrl: `/verify/certificate/${SAMPLE_CERTIFICATE_VERIFICATION_CODE}`,
  issuedAt: new Date().toISOString(),
  certificateType: "completion",
}

export function CampCertificatePreview({ template, data, className }: CampCertificatePreviewProps) {
  const sigs = enabledSignatories(template)
  const nameScale = template.typography.nameScale ?? 1
  const titleScale = template.typography.titleScale ?? 1
  const signatureScale = resolveSignatureScale(template)
  const signatureHeightPx = Math.round(CERTIFICATE_PREVIEW_SIG_HEIGHT_PX * signatureScale)
  const signatureOffsetY = resolveSignatureOffsetY(template)
  const signatureOffsetPct = signatureOffsetYToPreviewPercent(signatureOffsetY)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-slate-200 bg-[#fcfaf6] text-[#2d2d37]",
        "[font-family:'Cormorant_Garamond',Georgia,'Times_New_Roman',serif]",
        className,
      )}
      style={{ aspectRatio: "11 / 8.5" }}
    >
      {isBlockEnabled(template, "watermark") && (
        <div
          className="pointer-events-none absolute bottom-[5%] right-[4%] top-[10%] z-0 w-[36%]"
          style={{ opacity: CERTIFICATE_WATERMARK_OPACITY }}
          aria-hidden
        >
          <Image
            src={template.assets.watermarkImageUrl || "/summer-camp/certificate-watermark.png"}
            alt=""
            fill
            className="object-contain object-right-bottom"
            unoptimized
          />
        </div>
      )}

      {isBlockEnabled(template, "border") && (
        <>
          <div className="pointer-events-none absolute inset-3 border border-[#582c83]" />
          <div className="pointer-events-none absolute inset-[18px] border border-[#c4a052]/80" />
          {(
            [
              "top-[12px] left-[12px] border-t-2 border-l-2",
              "top-[12px] right-[12px] border-t-2 border-r-2",
              "bottom-[12px] left-[12px] border-b-2 border-l-2",
              "bottom-[12px] right-[12px] border-b-2 border-r-2",
            ] as const
          ).map((pos) => (
            <div
              key={pos}
              className={cn("pointer-events-none absolute size-4 border-[#c4a052]", pos)}
              aria-hidden
            />
          ))}
        </>
      )}

      <div className="relative z-10 flex h-full flex-col px-[7%] pb-[5%] pt-[6%]">
        {isBlockEnabled(template, "header") && (
          <header className="relative grid min-h-[52px] grid-cols-3 gap-0 pb-4">
            <div
              className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-[#582c83]/30"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-[#582c83]/30"
              aria-hidden
            />
            <div className="flex items-center pr-3">
              {template.assets.pvamuLogoUrl ? (
                <Image
                  src={template.assets.pvamuLogoUrl}
                  alt="Prairie View A&M University"
                  width={120}
                  height={40}
                  className="h-10 w-full max-w-[160px] object-contain object-left"
                  unoptimized
                />
              ) : (
                <p className="text-[10px] font-bold leading-tight text-[#582c83] [font-family:Georgia,serif]">
                  {template.universityLine}
                </p>
              )}
            </div>
            <div className="flex flex-col justify-center px-3 [font-family:Helvetica,Arial,sans-serif]">
              {collegeHeaderLines(template).map((line, i) =>
                line ? (
                  <p
                    key={`college-${i}`}
                    className={cn(
                      "text-[8.5px] font-bold uppercase leading-tight text-[#582c83]",
                      i > 0 && "mt-0.5",
                    )}
                  >
                    {line}
                  </p>
                ) : null,
              )}
              {departmentHeaderLines(template).map((line, i) =>
                line ? (
                  <p
                    key={`dept-${i}`}
                    className={cn(
                      "text-[7.5px] leading-tight text-[#582c83]/90",
                      i === 0 ? "mt-1" : "mt-0.5",
                    )}
                  >
                    {line}
                  </p>
                ) : null,
              )}
            </div>
            <div className="flex items-center pl-3 [font-family:Helvetica,Arial,sans-serif]">
              {template.assets.creditLogoUrl ? (
                <Image
                  src={template.assets.creditLogoUrl}
                  alt={template.creditCenterLine || "Partner institution"}
                  width={160}
                  height={40}
                  className="ml-auto h-10 w-full max-w-[180px] object-contain object-right"
                  unoptimized
                />
              ) : (
                <div className="ml-auto text-right">
                  <p className="text-[9px] font-bold text-[#582c83]">{template.creditCenterLine}</p>
                  <p className="mt-0.5 max-w-[140px] text-[7px] leading-snug text-slate-500">
                    {template.creditCenterSubtitle}
                  </p>
                </div>
              )}
            </div>
          </header>
        )}

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {isBlockEnabled(template, "certificateTitle") && (
            <div className="mb-5">
              <h1
                className="font-normal tracking-[0.35em] text-[#582c83]"
                style={{ fontSize: `${1.75 * titleScale}rem` }}
              >
                {template.certificateTitle}
              </h1>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="h-px w-12 bg-[#c4a052]" />
                <p
                  className="tracking-[0.2em] text-[#c4a052]"
                  style={{ fontSize: `${0.7 * titleScale}rem` }}
                >
                  {template.certificateSubtitle}
                </p>
                <span className="h-px w-12 bg-[#c4a052]" />
              </div>
            </div>
          )}

          {isBlockEnabled(template, "presentedTo") && (
            <div className="mb-4">
              <p className="mb-2 text-[9px] tracking-[0.25em] text-slate-500 [font-family:Helvetica,Arial,sans-serif]">
                {template.presentedToLabel}
              </p>
              <p
                className="font-bold uppercase leading-none text-[#582c83]"
                style={{ fontSize: `${2.4 * nameScale}rem` }}
              >
                {data.studentName}
              </p>
              <div className="mx-auto mt-2 size-2 rotate-45 bg-[#c4a052]" />
            </div>
          )}

          {isBlockEnabled(template, "completionStatement") && (
            <div className="max-w-xl space-y-2 [font-family:Helvetica,Arial,sans-serif]">
              <p className="text-[9px] tracking-[0.2em] text-slate-500">{template.completionLeadIn}</p>
              <p className="text-lg font-bold uppercase tracking-wide text-[#582c83] [font-family:Georgia,serif]">
                {data.trainingName}
              </p>
            </div>
          )}

          {isBlockEnabled(template, "programLine") && template.programLine.trim() && (
            <div className="mt-3 max-w-md [font-family:Helvetica,Arial,sans-serif]">
              <p className="text-[8px] tracking-[0.15em] text-slate-500">AS PART OF THE</p>
              <p className="text-sm font-semibold italic text-slate-700">{template.programLine}</p>
            </div>
          )}
        </div>

        {isBlockEnabled(template, "signatures") && sigs.length > 0 && (
          <div className="relative mb-3 flex justify-center gap-14">
            {isBlockEnabled(template, "seal") && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-0 -translate-x-1/2">
                <Image
                  src={template.assets.sealImageUrl || CERTIFICATE_SEAL_URL}
                  alt="University seal"
                  width={64}
                  height={64}
                  className="h-14 w-14 object-contain"
                  unoptimized
                />
              </div>
            )}
            {sigs.map((sig) => (
              <div
                key={sig.id}
                className="z-10 flex w-28 flex-col items-center text-center [font-family:Helvetica,Arial,sans-serif]"
              >
                <div
                  className="flex w-full shrink-0 items-end justify-center"
                  style={{
                    height: signatureHeightPx,
                    transform: `translateY(${signatureOffsetPct}%)`,
                  }}
                >
                  {sig.signatureImageUrl ? (
                    <Image
                      src={sig.signatureImageUrl}
                      alt=""
                      width={120}
                      height={40}
                      className="mx-auto block w-auto max-w-full object-contain object-center"
                      style={{ height: signatureHeightPx }}
                      unoptimized
                    />
                  ) : null}
                </div>
                <div className="mt-4 w-24 shrink-0 border-t border-slate-400" />
                <p className="mt-1.5 text-[7px] font-bold uppercase leading-snug text-[#582c83]">
                  {sig.name}
                  <br />
                  <span className="font-normal normal-case text-slate-600">
                    {sig.title}
                    {sig.department ? (
                      <>
                        <br />
                        {sig.department}
                      </>
                    ) : null}
                    <br />
                    {sig.organization}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        {(isBlockEnabled(template, "footer") || isBlockEnabled(template, "qrCode")) && (
          <footer className="relative mt-auto grid min-h-[48px] grid-cols-3 items-center pt-1 [font-family:Helvetica,Arial,sans-serif]">
            <div
              className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-[#582c83]/30"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-[#582c83]/30"
              aria-hidden
            />
            {isBlockEnabled(template, "footer") ? (
              <div className="text-center">
                <p className="text-[8px] font-medium tracking-wide text-slate-800">
                  {formatCertificateFooterDate(data.issuedAt)}
                </p>
                <p className="mt-0.5 text-[6px] tracking-[0.2em] text-slate-500">DATE</p>
              </div>
            ) : (
              <div />
            )}
            {isBlockEnabled(template, "footer") ? (
              <div className="text-center">
                <p className="text-[8px] font-medium text-slate-800">{data.certificateNumber}</p>
                <p className="mt-0.5 text-[6px] tracking-[0.15em] text-slate-500">CERTIFICATE ID</p>
              </div>
            ) : (
              <div />
            )}
            {isBlockEnabled(template, "qrCode") ? (
              <div className="flex justify-center">
                <QRCodeSVG value={data.verificationUrl} size={40} fgColor="#582c83" bgColor="transparent" />
              </div>
            ) : (
              <div />
            )}
          </footer>
        )}
      </div>
    </div>
  )
}
