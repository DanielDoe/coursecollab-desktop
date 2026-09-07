"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import QRCode from "qrcode"
import { Printer, RectangleHorizontal, RectangleVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type PrintOrientation = "portrait" | "landscape"

type OfficeHoursDoorSignPageProps = {
  instructorName: string
  department: string | null
  publicUrl: string
}

const STEPS = [
  "Scan the QR code with your phone camera.",
  "Choose your semester on the page.",
  "View office hours for your course section.",
] as const

function buildPrintStyles(orientation: PrintOrientation): string {
  const pageW = orientation === "portrait" ? "210mm" : "297mm"
  const pageH = orientation === "portrait" ? "297mm" : "210mm"

  return `
    @page {
      size: A4 ${orientation};
      margin: 0;
    }

    @media print {
      html,
      body {
        width: ${pageW};
        height: ${pageH};
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .door-sign-toolbar {
        display: none !important;
      }

      .door-sign-screen {
        min-height: 0 !important;
        background: #ffffff !important;
        padding: 0 !important;
      }

      .door-sign-sheet {
        width: ${pageW};
        height: ${pageH};
        padding: 0;
        margin: 0;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .door-sign-card {
        box-shadow: none !important;
        border: 1px solid #cbd5e1 !important;
      }
    }
  `
}

function SignSteps({ className }: { className?: string }) {
  return (
    <ol className={cn("space-y-1.5 text-[12px] leading-snug text-slate-600", className)}>
      {STEPS.map((step, index) => (
        <li key={step} className="flex gap-2">
          <span className="w-4 shrink-0 font-semibold text-teal-700">{index + 1}.</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function OfficeHoursDoorSignPage({
  instructorName,
  department,
  publicUrl,
}: OfficeHoursDoorSignPageProps) {
  const qrRef = useRef<HTMLCanvasElement>(null)
  const [orientation, setOrientation] = useState<PrintOrientation>("portrait")
  const isLandscape = orientation === "landscape"
  const printStyles = useMemo(() => buildPrintStyles(orientation), [orientation])

  useEffect(() => {
    const canvas = qrRef.current
    if (!canvas) return
    QRCode.toCanvas(canvas, publicUrl, {
      width: isLandscape ? 220 : 260,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(() => {})
  }, [publicUrl, isLandscape])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />

      <div className="door-sign-screen min-h-screen bg-slate-100 print:bg-white">
        <div className="door-sign-toolbar no-print sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-2.5">
          <div className="mx-auto flex max-w-5xl flex-nowrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700 shrink-0">Door sign preview</p>
            <div className="flex flex-nowrap items-center gap-2 shrink-0">
              <ToggleGroup
                type="single"
                value={orientation}
                onValueChange={(value) => {
                  if (value === "portrait" || value === "landscape") setOrientation(value)
                }}
                variant="outline"
                size="sm"
                className="rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-sm"
                aria-label="Print orientation"
              >
                <ToggleGroupItem
                  value="portrait"
                  aria-label="Portrait"
                  className="h-8 rounded-md px-2.5 sm:px-3 data-[state=on]:border-teal-200 data-[state=on]:bg-white data-[state=on]:text-teal-800 data-[state=on]:shadow-sm"
                >
                  <RectangleVertical className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Portrait</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="landscape"
                  aria-label="Landscape"
                  className="h-8 rounded-md px-2.5 sm:px-3 data-[state=on]:border-teal-200 data-[state=on]:bg-white data-[state=on]:text-teal-800 data-[state=on]:shadow-sm"
                >
                  <RectangleHorizontal className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Landscape</span>
                </ToggleGroupItem>
              </ToggleGroup>
              <Button type="button" onClick={() => window.print()} size="sm" className="h-8 shrink-0 rounded-lg px-3">
                <Printer className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Print / Save PDF</span>
                <span className="sm:hidden sr-only">Print</span>
              </Button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "door-sign-sheet mx-auto flex items-center justify-center p-4 sm:p-6 print:min-h-0 print:p-0",
            isLandscape ? "min-h-[calc(100vh-73px)]" : "min-h-[calc(100vh-57px)]",
          )}
        >
          {isLandscape ? (
            <article
              className="door-sign-card grid w-full max-w-[268mm] grid-cols-[1fr_1px_1fr] items-center gap-0 rounded-2xl border border-slate-200 bg-white px-8 py-7 shadow-xl print:max-w-[268mm] print:px-7 print:py-6"
              aria-label={`Office hours door sign for ${instructorName}`}
            >
              <div className="min-w-0 pr-8">
                <div className="flex items-center gap-2 text-slate-500">
                  <Image
                    src="/brand/course-collab-mark-512.png"
                    alt=""
                    width={26}
                    height={26}
                    className="rounded-md"
                    aria-hidden
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    CourseCollab · PVAMU
                  </p>
                </div>

                <h1 className="mt-3 text-[1.45rem] font-semibold leading-tight tracking-tight text-slate-900">
                  Office Hours
                </h1>

                <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-slate-600">
                  Scan to view current course office hours anytime.
                </p>

                <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-2.5">
                  <canvas ref={qrRef} className="h-[32mm] w-[32mm]" aria-label="Office hours QR code" />
                </div>
              </div>

              <div className="h-[78%] min-h-[88mm] w-px self-center bg-slate-200" aria-hidden />

              <div className="min-w-0 pl-8">
                <p className="text-[1.15rem] font-semibold leading-tight text-slate-900">{instructorName}</p>
                {department ? (
                  <p className="mt-1 text-[13px] leading-snug text-slate-600">{department}</p>
                ) : null}

                <SignSteps className="mt-5" />

                <p className="mt-4 break-all font-mono text-[9px] leading-relaxed text-slate-400">{publicUrl}</p>
              </div>
            </article>
          ) : (
            <article
              className="door-sign-card w-full max-w-[118mm] rounded-2xl border border-slate-200 bg-white px-7 py-8 text-center shadow-xl print:max-w-[118mm] print:px-6 print:py-7"
              aria-label={`Office hours door sign for ${instructorName}`}
            >
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Image
                  src="/brand/course-collab-mark-512.png"
                  alt=""
                  width={26}
                  height={26}
                  className="rounded-md"
                  aria-hidden
                />
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  CourseCollab · PVAMU
                </p>
              </div>

              <h1 className="mt-3 text-[1.55rem] font-semibold leading-tight tracking-tight text-slate-900">
                Office Hours
              </h1>

              <p className="mx-auto mt-2 max-w-[28ch] text-[13px] leading-relaxed text-slate-600">
                Scan to view current course office hours anytime.
              </p>

              <div className="mx-auto mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-2.5">
                <canvas ref={qrRef} className="h-[36mm] w-[36mm]" aria-label="Office hours QR code" />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[1.05rem] font-semibold text-slate-900">{instructorName}</p>
                {department ? <p className="mt-1 text-[13px] text-slate-600">{department}</p> : null}
              </div>

              <SignSteps className="mx-auto mt-4 max-w-[58mm] text-left" />

              <p className="mt-4 break-all font-mono text-[9px] leading-relaxed text-slate-400">{publicUrl}</p>
            </article>
          )}
        </div>
      </div>
    </>
  )
}
