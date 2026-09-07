"use client"

import { useState, type ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  LICENSE_COMPARISON,
  individualCost,
  money,
  moneyAxis,
  savings,
  savingsPct,
  type LicenseComparisonRow,
} from "@/lib/institutions/licensing-comparison"
import { Card, Eyebrow, SlideShell, SlideTitle, Subhead, Thesis } from "@/components/pitch/pitch-ui"
import { cn } from "@/lib/utils"

const DEPARTMENT = LICENSE_COMPARISON.find((r) => r.key === "department")!

export function LicensingTableSlide() {
  return (
    <SlideShell>
      <Eyebrow>Institutional licensing</Eyebrow>
      <SlideTitle>Cost and savings at scale</SlideTitle>
      <Subhead>
        Institutional licensing reduces the cost of providing premium CourseCollab access
        compared with equivalent individual memberships.
      </Subhead>

      <div className="mt-4 overflow-x-auto overscroll-x-contain rounded-2xl border border-white/10">
        <table className="w-full min-w-[640px] text-left text-[13px] sm:text-[15px]">
          <thead className="bg-white/[0.04] text-[13px] font-semibold uppercase tracking-[0.12em] text-white/45">
            <tr>
              <th className="px-3 py-2.5">License</th>
              <th className="px-2 py-2.5 text-right">Students</th>
              <th className="px-2 py-2.5 text-right">Faculty</th>
              <th className="px-2 py-2.5 text-right text-[#EAAA00]">License / year</th>
              <th className="px-2 py-2.5 text-right">2 semesters</th>
              <th className="px-2 py-2.5 text-right">3 semesters</th>
              <th className="px-3 py-2.5 text-right text-[#F6D56A]">Savings</th>
            </tr>
          </thead>
          <tbody>
            {LICENSE_COMPARISON.map((row) => (
              <tr
                key={row.key}
                className={cn(
                  "border-t border-white/8",
                  row.emphasize === "department" && "bg-[#EAAA00]/10",
                  row.emphasize === "college" && "bg-white/[0.045]",
                )}
              >
                <td className="px-3 py-2 font-semibold text-white">
                  {row.name}
                  {row.facultyIllustrative ? <span className="text-white/35"> *</span> : null}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-white/70">
                  {row.students.toLocaleString()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-white/70">
                  {row.faculty}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-[#EAAA00]">
                  {money(row.institutional)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-white/70">
                  {money(individualCost(row, 2))}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-white/80">
                  {money(individualCost(row, 3))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <p className="font-semibold text-[#F6D56A]">{money(savings(row, 2))} <span className="font-normal text-white/40">2 sem</span></p>
                  <p className="font-semibold text-[#F6D56A]">{money(savings(row, 3))} <span className="font-normal text-white/40">3 sem</span></p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.15fr]">
        <Card className="border-[#EAAA00]/30 bg-[#EAAA00]/8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#EAAA00]">
            Department example · 500 students + 15 faculty
          </p>
          <p className="mt-2 text-[18px] leading-snug text-white">
            Fall + Spring + Summer individual memberships{" "}
            <span className="text-white/45">{money(individualCost(DEPARTMENT, 3))}</span>
            {" → "}
            <span className="text-[#F6D56A]">{money(DEPARTMENT.institutional)}</span>
          </p>
          <p className="mt-1.5 text-[18px] text-white/70">
            {money(savings(DEPARTMENT, 3))} annual savings · {savingsPct(DEPARTMENT, 3).toFixed(0)}%
            lower cost
          </p>
        </Card>
        <p className="self-center text-[16px] leading-relaxed text-white/45">
          Student Trailblazer $39.99/semester. Instructor Pro $99/semester. Faculty counts beyond
          Course Pilot are illustrative. Institutional plans include faculty within the licensed
          organizational scope.
        </p>
      </div>

      <Thesis>
        At college scale, an annual license can reduce equivalent individual membership costs by
        more than $230,000 when students and faculty would otherwise renew each semester.
      </Thesis>
    </SlideShell>
  )
}

type Semesters = 2 | 3

export function LicensingChartSlide() {
  const [semesters, setSemesters] = useState<Semesters>(3)
  const data = LICENSE_COMPARISON.map((row) => ({
    plan: row.short,
    name: row.name,
    individual: individualCost(row, semesters),
    institutional: row.institutional,
    row,
  }))

  return (
    <SlideShell>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <Eyebrow>The economics</Eyebrow>
          <SlideTitle>The value of institutional access grows with scale</SlideTitle>
          <Subhead>
            One annual license replaces individual student and faculty memberships across the
            licensed organization.
          </Subhead>
        </div>
        <div className="flex w-full shrink-0 rounded-full border border-white/12 bg-white/[0.04] p-0.5 sm:w-auto">
          <SemBtn active={semesters === 2} onClick={() => setSemesters(2)}>
            Fall + Spring
          </SemBtn>
          <SemBtn active={semesters === 3} onClick={() => setSemesters(3)}>
            Fall + Spring + Summer
          </SemBtn>
        </div>
      </div>

      <div
        className="mt-3 h-[min(38vh,280px)] min-h-[220px] w-full sm:h-[min(42vh,320px)] sm:min-h-[260px] lg:h-[min(48vh,400px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis
              dataKey="plan"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 14 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={moneyAxis}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 13 }}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={<SavingsTooltip semesters={semesters} />}
            />
            <Legend
              wrapperStyle={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }}
              iconType="circle"
            />
            <Bar
              dataKey="individual"
              name="Individual memberships"
              fill="#b794e8"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="institutional"
              name="Institutional license"
              fill="#EAAA00"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Thesis>
        The institutional model becomes increasingly economical as adoption scales, while providing
        year-round access without requiring individual memberships each semester.
      </Thesis>
    </SlideShell>
  )
}

function SemBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[15px] font-semibold",
        active ? "bg-[#EAAA00] text-[#1e1033]" : "text-white/60 hover:text-white",
      )}
    >
      {children}
    </button>
  )
}

function SavingsTooltip({
  active,
  payload,
  semesters,
}: {
  active?: boolean
  payload?: Array<{ payload: { name: string; row: LicenseComparisonRow } }>
  semesters: Semesters
}) {
  if (!active || !payload?.[0]) return null
  const { row, name } = payload[0].payload
  return (
    <div className="min-w-[220px] rounded-xl border border-white/12 bg-[#140d1c] px-3.5 py-3 text-[15px] shadow-2xl">
      <p className="font-semibold text-white">{name}</p>
      <p className="mt-0.5 text-[14px] text-white/45">
        {row.students.toLocaleString()} students · {row.faculty} faculty
      </p>
      <div className="mt-2 space-y-1 text-white/70">
        <Row label={`${semesters} semester${semesters === 3 ? "s" : ""}`} value={money(individualCost(row, semesters))} />
        <Row label="Institutional" value={money(row.institutional)} gold />
        <Row label="Annual savings" value={money(savings(row, semesters))} gold />
        <Row label="Cost reduction" value={`${savingsPct(row, semesters).toFixed(0)}%`} gold />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  gold,
}: {
  label: string
  value: string
  gold?: boolean
}) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-white/45">{label}</span>
      <span className={gold ? "font-semibold text-[#F6D56A]" : "font-medium text-white"}>
        {value}
      </span>
    </div>
  )
}
