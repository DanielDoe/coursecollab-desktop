"use client"

import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { figureHeading, figureSourceLine, type CataloguedFigure } from "@/lib/projects/project-report-figures"

export function ReportFigureGallery({ figures }: { figures: CataloguedFigure[] }) {
  if (!figures.length) return null
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <header className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>Appendix A</p>
        <h2 className={cn("mt-0.5 text-base font-semibold", PORTAL_TEXT)}>Figures</h2>
        <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
          Every image attached in the report, numbered so the downloaded PDF can cite it instead of wrapping pictures into the body text.
        </p>
      </header>
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:px-5">
        {figures.map((figure) => (
          <figure key={`${figure.blockId}-${figure.number}`} className="overflow-hidden rounded-xl border border-[var(--border)] bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={figure.src} alt={figure.caption} className="h-44 w-full object-contain bg-[var(--card)]" />
            <figcaption className={cn("px-3 pt-2 text-sm font-medium", PORTAL_TEXT)}>{figureHeading(figure)}</figcaption>
            <p className={cn("px-3 pb-3 text-xs", PORTAL_TEXT_MUTED)}>{figureSourceLine(figure)}</p>
          </figure>
        ))}
      </div>
    </section>
  )
}
