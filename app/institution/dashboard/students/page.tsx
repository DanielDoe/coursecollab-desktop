"use client"

import { useMemo, useState } from "react"
import { Gauge, UserCheck, UserX, Users } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionDataTable,
  InstitutionEmptyState,
  InstitutionKpiGrid,
  InstitutionSectionCard,
  InstitutionStatusBadge,
  InstitutionToolbar,
} from "@/components/institution/portal/InstitutionPortalUi"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

type StudentsPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/roster").getInstitutionStudentsModule>> & {
  canViewAcademic?: boolean
  activeLearnerDefinition?: { id: string; label: string; description: string }
}

function activityTone(s: string): "success" | "warning" | "muted" {
  if (s === "Active") return "success"
  if (s === "Inactive") return "warning"
  return "muted"
}

export default function InstitutionStudentsPage() {
  const { data, loading, error } = useInstitutionJson<StudentsPayload>("/api/institution/students")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.students ?? []).filter((s) => {
      if (statusFilter !== "all" && s.activityStatus !== statusFilter) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.institutionId?.toLowerCase().includes(q) ?? false) ||
        s.courseCode.toLowerCase().includes(q)
      )
    })
  }, [data?.students, search, statusFilter])

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  const k = data?.kpis

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        {k ? (
          <InstitutionKpiGrid
            items={[
              { label: "Sponsored students", value: k.sponsored, sub: "In license scope", icon: Users, valueKind: "count" },
              { label: "Active", value: k.active, sub: "Recent activity", icon: UserCheck, valueKind: "count" },
              { label: "Inactive", value: k.inactive, sub: "14+ days quiet", icon: UserX, valueKind: "count" },
              {
                label: "License capacity",
                value: k.seatLimit != null ? `${k.licenseUsed} / ${k.seatLimit}` : k.licenseUsed,
                sub: "Active learners in contract",
                icon: Gauge,
              },
            ]}
          />
        ) : null}

        <InstitutionSectionCard title="Student roster" hint="Active learner capacity counts unique students with qualifying activity in the contract period — not total enrollment.">
          <InstitutionToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search name, email, ID, or course…"
            filters={
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All activity</option>
                {["Active", "Quiet", "Inactive"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            }
          />
          <InstitutionDataTable
            rows={rows}
            rowKey={(r) => `${r.id}-${r.courseId}`}
            empty={
              <InstitutionEmptyState
                title="No sponsored students"
                body="Students enrolled in license-covered courses appear here once your contract is active."
              />
            }
            columns={[
              { key: "name", label: "Student", render: (r) => r.name },
              { key: "instId", label: "Institution ID", render: (r) => r.institutionId ?? "—" },
              { key: "course", label: "Course", render: (r) => `${r.courseCode}` },
              { key: "sponsor", label: "Membership source", render: (r) => r.sponsorship },
              {
                key: "license",
                label: "Counts toward license",
                render: (r) => (
                  <InstitutionStatusBadge
                    label={r.countsTowardLicense ? "Yes" : "No"}
                    tone={r.countsTowardLicense ? "success" : "muted"}
                  />
                ),
              },
              { key: "last", label: "Last active", render: (r) => r.lastActive ?? "—" },
              {
                key: "activity",
                label: "Activity",
                render: (r) => <InstitutionStatusBadge label={r.activityStatus} tone={activityTone(r.activityStatus)} />,
              },
              ...(data?.canViewAcademic
                ? [{ key: "cora", label: "Cora", render: (r: (typeof rows)[0]) => String(r.coraWorkflows) }]
                : []),
            ]}
          />
        </InstitutionSectionCard>
      </div>
    </InstitutionModulePage>
  )
}
