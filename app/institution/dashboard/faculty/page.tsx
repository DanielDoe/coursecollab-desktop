"use client"

import { useMemo, useState } from "react"
import { BookOpen, GraduationCap, Mail, Sparkles, UserCheck, UserX } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionDataTable,
  InstitutionEmptyState,
  InstitutionKpiGrid,
  InstitutionSectionCard,
  InstitutionStatusBadge,
  InstitutionToolbar,
} from "@/components/institution/portal/InstitutionPortalUi"
import { PORTAL_CTA, PORTAL_SOLID_DANGER, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

type FacultyPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/roster").getInstitutionFacultyModule>> & {
  canManage?: boolean
}

function statusTone(status: string): "success" | "warning" | "muted" | "danger" {
  if (status === "active") return "success"
  if (status === "invited") return "warning"
  if (status === "suspended") return "danger"
  return "muted"
}

export default function InstitutionFacultyPage() {
  const { data, loading, error, setData } = useInstitutionJson<FacultyPayload>("/api/institution/faculty")
  const [email, setEmail] = useState("")
  const { confirm } = useAppConfirm()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.faculty ?? []).filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false
      if (!q) return true
      return f.email.toLowerCase().includes(q) || (f.name?.toLowerCase().includes(q) ?? false)
    })
  }, [data?.faculty, search, statusFilter])

  async function refresh() {
    const res = await fetch("/api/institution/faculty", { credentials: "include" })
    if (res.ok) setData(await res.json())
  }

  async function invite() {
    setBusy(true)
    const res = await fetch("/api/institution/faculty", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setBusy(false)
    if (res.ok) {
      setEmail("")
      await refresh()
    }
  }

  async function remove(memberId: number) {
    const ok = await confirm({
      title: "Remove institutional sponsorship?",
      description: "Personal memberships are not deleted.",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return
    await fetch(`/api/institution/faculty?memberId=${memberId}`, { method: "DELETE", credentials: "include" })
    await refresh()
  }

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  const k = data?.kpis
  const inactiveCount = (data?.faculty ?? []).filter((f) => f.status === "inactive" || f.status === "suspended").length

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        {k ? (
          <InstitutionKpiGrid
            items={[
              { label: "Covered faculty", value: k.covered, sub: "Institution sponsored", icon: GraduationCap, valueKind: "count" },
              { label: "Active", value: k.active, sub: "Currently teaching", icon: UserCheck, valueKind: "count" },
              { label: "Pending invites", value: k.invited, sub: "Awaiting acceptance", icon: Mail, valueKind: "count" },
              { label: "Using Cora", value: k.usingCora, sub: "With AI workflows", icon: Sparkles, valueKind: "count" },
              { label: "Courses managed", value: k.coursesManaged, sub: "Across roster", icon: BookOpen, valueKind: "count" },
              { label: "Inactive", value: inactiveCount, sub: "Not currently active", icon: UserX, valueKind: "count" },
            ]}
          />
        ) : null}

        {data?.canManage ? (
          <InstitutionSectionCard title="Invite faculty">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                void invite()
              }}
            >
              <input
                className="h-10 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                placeholder="Instructor email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={busy} className={cn(PORTAL_CTA, "h-10 rounded-xl px-4 text-sm")}>
                Invite
              </button>
            </form>
          </InstitutionSectionCard>
        ) : null}

        <InstitutionSectionCard title="Faculty roster">
          <InstitutionToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search name or email…"
            filters={
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {["active", "invited", "inactive", "suspended"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            }
          />
          <InstitutionDataTable
            rows={rows}
            rowKey={(r) => r.memberId}
            empty={
              <InstitutionEmptyState
                title="No faculty invited"
                body="Invite instructors to grant institutional sponsorship and Cora access within your license scope."
                actionLabel={data?.canManage ? undefined : undefined}
              />
            }
            columns={[
              {
                key: "name",
                label: "Faculty",
                render: (r) => r.name ?? r.email,
              },
              { key: "email", label: "Email" },
              { key: "role", label: "Role", render: (r) => <span className="capitalize">{r.role.replaceAll("_", " ")}</span> },
              { key: "courses", label: "Courses", render: (r) => String(r.courses) },
              { key: "access", label: "Institutional access", render: (r) => <InstitutionStatusBadge label={r.institutionalAccess} tone={statusTone(r.status)} /> },
              { key: "cora", label: "Cora", render: (r) => `${r.coraWorkflows} · ${r.coraCredits.toLocaleString()} cr` },
              { key: "last", label: "Last active", render: (r) => r.lastActive ?? "—" },
              {
                key: "status",
                label: "Status",
                render: (r) => <InstitutionStatusBadge label={r.status} tone={statusTone(r.status)} />,
              },
              {
                key: "actions",
                label: "",
                render: (r) =>
                  data?.canManage ? (
                    <button type="button" className={cn(PORTAL_SOLID_DANGER, "rounded-lg px-2 py-1 text-xs")} onClick={() => void remove(r.memberId)}>
                      Remove
                    </button>
                  ) : null,
              },
            ]}
          />
        </InstitutionSectionCard>
      </div>
    </InstitutionModulePage>
  )
}
