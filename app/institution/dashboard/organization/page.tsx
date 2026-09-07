"use client"

import { useCallback, useState } from "react"
import { ChevronDown, ChevronRight, BookOpen, Building2, Layers, Network } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionEmptyState,
  InstitutionKpiGrid,
  InstitutionKeyValueList,
  InstitutionSectionCard,
  InstitutionStatusBadge,
  InstitutionToolbar,
} from "@/components/institution/portal/InstitutionPortalUi"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { OrgTreeNode } from "@/lib/institutions/portal/organization"
import { cn } from "@/lib/utils"

type OrgPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/organization").getInstitutionOrganizationModule>> & {
  permissions?: string[]
  canManage?: boolean
}

type UnitDetail = Awaited<ReturnType<typeof import("@/lib/institutions/portal/organization").getOrganizationUnitDetail>>

function coverageTone(c: OrgTreeNode["coverage"]): "success" | "warning" | "muted" {
  if (c === "covered") return "success"
  if (c === "partial") return "warning"
  return "muted"
}

function OrgTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  search,
}: {
  node: OrgTreeNode
  depth: number
  selectedId: string | null
  onSelect: (node: OrgTreeNode) => void
  search: string
}) {
  const [open, setOpen] = useState(depth < 2)
  const q = search.trim().toLowerCase()
  const matches =
    !q ||
    node.name.toLowerCase().includes(q) ||
    (node.code?.toLowerCase().includes(q) ?? false) ||
    node.children.some((c) => c.name.toLowerCase().includes(q))
  if (!matches) return null
  const hasChildren = node.children.length > 0
  const selected = selectedId === node.id

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          "flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/40",
          selected && "bg-[var(--cc-accent-soft)]",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <span
            role="presentation"
            className="shrink-0 text-[var(--cc-text-secondary)]"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((v) => !v)
            }}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </span>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <span className={cn("min-w-0 flex-1 truncate", PORTAL_TEXT)}>{node.name}</span>
        <InstitutionStatusBadge label={node.type} tone="info" />
      </button>
      {open && hasChildren
        ? node.children.map((child) => (
            <OrgTreeItem key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} search={search} />
          ))
        : null}
    </div>
  )
}

export default function InstitutionOrganizationPage() {
  const { data, loading, error, setData } = useInstitutionJson<OrgPayload>("/api/institution/organization")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<OrgTreeNode | null>(null)
  const [unitDetail, setUnitDetail] = useState<UnitDetail | null>(null)
  const [name, setName] = useState("")
  const [unitType, setUnitType] = useState("department")
  const [parentUnitId, setParentUnitId] = useState<number | "">("")

  const canManage = data?.permissions?.includes("manage_organization") ?? false

  const loadUnit = useCallback(async (node: OrgTreeNode) => {
    setSelected(node)
    if (node.unitId) {
      const res = await fetch(`/api/institution/organization?unitId=${node.unitId}`, { credentials: "include" })
      if (res.ok) {
        const json = (await res.json()) as { unit: UnitDetail }
        setUnitDetail(json.unit)
      }
    } else {
      setUnitDetail(null)
    }
  }, [])

  async function addUnit() {
    const res = await fetch("/api/institution/organization", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, unitType, parentUnitId: parentUnitId || undefined }),
    })
    if (res.ok) {
      setName("")
      const refreshed = await fetch("/api/institution/organization", { credentials: "include" })
      if (refreshed.ok) setData(await refreshed.json())
    }
  }

  const summary = data?.summary

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        {summary ? (
          <InstitutionKpiGrid
            items={[
              { label: "Colleges / schools", value: summary.colleges, sub: "Top-level units", icon: Building2, valueKind: "count" },
              { label: "Departments", value: summary.departments, sub: "Academic departments", icon: Network, valueKind: "count" },
              { label: "Programs", value: summary.programs, sub: "Degree programs", icon: Layers, valueKind: "count" },
              { label: "Licensed courses", value: summary.activeCourses, sub: "Under active contract", icon: BookOpen, valueKind: "count" },
            ]}
          />
        ) : null}

        {canManage ? (
          <InstitutionSectionCard title="Add organizational unit">
            <form
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
              onSubmit={(e) => {
                e.preventDefault()
                void addUnit()
              }}
            >
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
              >
                {["college", "school", "department", "program"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                value={parentUnitId}
                onChange={(e) => setParentUnitId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">No parent</option>
                {(data?.flatUnits ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input
                className="h-10 min-w-[160px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                placeholder="Unit name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <button type="submit" className={cn(PORTAL_CTA, "h-10 rounded-xl px-4 text-sm")}>Create unit</button>
            </form>
          </InstitutionSectionCard>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <InstitutionSectionCard title="Organization tree">
            <InstitutionToolbar search={search} onSearchChange={setSearch} placeholder="Search units or courses…" />
            {(data?.tree ?? []).length === 0 ? (
              <InstitutionEmptyState
                title="No departments configured"
                body="Create colleges, departments, and programs to mirror your institution structure."
                actionLabel={canManage ? undefined : "Contact your institution admin"}
              />
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                {(data?.tree ?? []).map((node) => (
                  <OrgTreeItem key={node.id} node={node} depth={0} selectedId={selected?.id ?? null} onSelect={loadUnit} search={search} />
                ))}
              </div>
            )}
          </InstitutionSectionCard>

          <InstitutionSectionCard title={selected ? selected.name : "Unit details"} hint="Select a unit in the tree">
            {selected && selected.unitId && unitDetail ? (
              <InstitutionKeyValueList
                rows={[
                  { label: "Type", value: <span className="capitalize">{unitDetail.type}</span> },
                  { label: "Code", value: unitDetail.code ?? "—" },
                  { label: "Parent", value: unitDetail.parentName ?? "—" },
                  { label: "Active courses", value: String(unitDetail.activeCourses) },
                  { label: "Linked members", value: String(unitDetail.linkedMembers) },
                  {
                    label: "License coverage",
                    value: <InstitutionStatusBadge label={unitDetail.activeCourses > 0 ? "Covered" : "Not covered"} tone={unitDetail.activeCourses > 0 ? "success" : "muted"} />,
                  },
                ]}
              />
            ) : selected && !selected.unitId ? (
              <InstitutionKeyValueList
                rows={[
                  { label: "Type", value: selected.type },
                  { label: "Courses", value: String(selected.activeCourses) },
                  {
                    label: "Coverage",
                    value: <InstitutionStatusBadge label={selected.coverage} tone={coverageTone(selected.coverage)} />,
                  },
                ]}
              />
            ) : (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Select an organizational unit to view administrators, coverage, and linked courses.</p>
            )}
            {unitDetail && unitDetail.courses.length > 0 ? (
              <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
                {unitDetail.courses.map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <span className={PORTAL_TEXT}>{c.code}</span>
                    <span className={PORTAL_TEXT_MUTED}>{c.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </InstitutionSectionCard>
        </div>
      </div>
    </InstitutionModulePage>
  )
}
