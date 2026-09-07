"use client"

import { useMemo, useState } from "react"
import { BookOpen, Layers, Sparkles, Users } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import { ImsccImportWizard } from "@/components/imscc-import-wizard"
import {
  InstitutionDataTable,
  InstitutionEmptyState,
  InstitutionKpiGrid,
  InstitutionSectionCard,
  InstitutionStatusBadge,
  InstitutionToolbar,
} from "@/components/institution/portal/InstitutionPortalUi"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type CoursesPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/roster").getInstitutionCoursesModule>> & {
  canManage?: boolean
}
type FacultyPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/roster").getInstitutionFacultyModule>>

export default function InstitutionCoursesPage() {
  const { data, loading, error } = useInstitutionJson<CoursesPayload>("/api/institution/courses")
  const { data: facultyData } = useInstitutionJson<FacultyPayload>("/api/institution/faculty")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.courses ?? []).filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (!q) return true
      return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.instructor?.toLowerCase().includes(q) ?? false)
    })
  }, [data?.courses, search, statusFilter])

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  const k = data?.kpis

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        {k ? (
          <InstitutionKpiGrid
            items={[
              { label: "Active courses", value: k.activeCourses, sub: "Currently operating", icon: BookOpen, valueKind: "count" },
              { label: "Sections", value: k.sections, sub: "Active sections", icon: Layers, valueKind: "count" },
              { label: "Covered students", value: k.students, sub: "Enrolled learners", icon: Users, valueKind: "count" },
              { label: "Using Cora", value: k.coraCourses, sub: "Courses with AI usage", icon: Sparkles, valueKind: "count" },
            ]}
          />
        ) : null}

        {data?.canManage ? (
          <InstitutionSectionCard title="Import from Canvas">
            <p className={cn("mb-3 text-sm", PORTAL_TEXT_MUTED)}>
              Upload a Canvas Common Cartridge (.imscc) to create a CourseCollab course as drafts, then attach it to your license.
            </p>
            <ImsccImportWizard
              portal="institution"
              facultyOptions={(facultyData?.faculty ?? [])
                .filter((f) => f.instructorId != null)
                .map((f) => ({ instructorId: f.instructorId as number, name: f.name, email: f.email }))}
              onImported={() => {
                window.location.reload()
              }}
              commit={async (payload) => {
                const res = await fetch("/api/institution/courses/import/commit", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || "Import failed")
                return json
              }}
            />
          </InstitutionSectionCard>
        ) : null}

        <InstitutionSectionCard title="Covered courses">
          <InstitutionToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search code, title, instructor…"
            filters={
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            }
          />
          <InstitutionDataTable
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <InstitutionEmptyState
                title="No covered courses"
                body="Courses linked to your institutional license scope will appear here."
                actionLabel="View license"
                actionHref="/institution/dashboard/license"
              />
            }
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Course" },
              { key: "term", label: "Term", render: (r) => r.semester ?? "—" },
              { key: "sections", label: "Sections", render: (r) => String(r.sections) },
              { key: "instructor", label: "Instructor", render: (r) => r.instructor ?? "—" },
              { key: "students", label: "Students", render: (r) => String(r.activeStudents) },
              {
                key: "coverage",
                label: "Coverage",
                render: (r) => <InstitutionStatusBadge label={r.coverage} tone="success" />,
              },
              { key: "cora", label: "Cora", render: (r) => `${r.coraWorkflows} workflows` },
              { key: "submissions", label: "Submissions (30d)", render: (r) => String(r.submissions30d) },
              {
                key: "status",
                label: "Status",
                render: (r) => <InstitutionStatusBadge label={r.status} tone={r.status === "Active" ? "success" : "muted"} />,
              },
            ]}
          />
        </InstitutionSectionCard>
      </div>
    </InstitutionModulePage>
  )
}
