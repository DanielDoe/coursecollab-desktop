"use client"

import { useCallback, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Bell, Sparkles, Users } from "lucide-react"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionDataTable,
  InstitutionKeyValueList,
  InstitutionSectionCard,
  InstitutionStatusBadge,
} from "@/components/institution/portal/InstitutionPortalUi"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type SettingsPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/billing").getInstitutionSettingsModule>> & {
  canManageAdmins?: boolean
  role?: string
}

const SECTIONS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "administrators", label: "Administrators", icon: Users },
  { id: "cora", label: "Cora", icon: Sparkles },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

function parseSection(raw: string | null): SectionId {
  if (raw && SECTIONS.some((s) => s.id === raw)) return raw as SectionId
  return "general"
}

export default function InstitutionSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = parseSection(searchParams.get("section"))
  const { data, loading, error, setData } = useInstitutionJson<SettingsPayload>("/api/institution/settings")
  const [website, setWebsite] = useState("")
  const [saving, setSaving] = useState(false)

  const syncSection = useCallback(
    (id: SectionId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("section", id)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const saveGeneral = useCallback(async () => {
    setSaving(true)
    const res = await fetch("/api/institution/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "general", website: website || data?.general?.website }),
    })
    setSaving(false)
    if (res.ok) setData(await res.json())
  }, [data?.general?.website, setData, website])

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  const menu = (
    <FacultyModuleSideMenu
      moduleId="institution-settings"
      title="Settings"
      hideTitle
      embedded
      accent="theme"
      activeId={section}
      onSelect={(id) => syncSection(id as SectionId)}
      items={SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon }))}
    />
  )

  return (
    <InstitutionModulePage>
      <FacultyModuleSplitLayout menu={menu}>
        {section === "general" && data?.general ? (
          <InstitutionSectionCard title="General">
            <InstitutionKeyValueList
              rows={[
                { label: "Display name", value: data.general.displayName },
                { label: "Legal name", value: data.general.legalName ?? "—" },
                { label: "Domain", value: data.general.domain ?? "—" },
                { label: "Institution type", value: <span className="capitalize">{data.general.institutionType}</span> },
              ]}
            />
            <div className="mt-4">
              <label className={cn("mb-1 block text-xs", PORTAL_TEXT_MUTED)}>Website</label>
              <div className="flex gap-2">
                <input
                  className="h-10 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                  defaultValue={data.general.website ?? ""}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
                <button type="button" disabled={saving} className={cn(PORTAL_CTA, "h-10 rounded-xl px-4 text-sm")} onClick={() => void saveGeneral()}>
                  Save
                </button>
              </div>
            </div>
          </InstitutionSectionCard>
        ) : null}

        {section === "administrators" ? (
          <InstitutionSectionCard title="Administrators" hint="Role-based access controls institution operations">
            <InstitutionDataTable
              rows={data?.administrators ?? []}
              rowKey={(r) => r.id}
              columns={[
                { key: "name", label: "Admin" },
                { key: "email", label: "Email", render: (r) => r.email ?? "—" },
                { key: "role", label: "Role", render: (r) => <span className="capitalize">{r.role.replaceAll("_", " ")}</span> },
                { key: "last", label: "Last active", render: (r) => r.lastActive ?? "—" },
                {
                  key: "status",
                  label: "Status",
                  render: (r) => <InstitutionStatusBadge label={r.status} tone={r.status === "active" ? "success" : "muted"} />,
                },
              ]}
            />
            {!data?.canManageAdmins ? (
              <p className={cn("mt-3 text-xs", PORTAL_TEXT_MUTED)}>Contact an institution owner to change administrator roles.</p>
            ) : null}
          </InstitutionSectionCard>
        ) : null}

        {section === "cora" && data?.cora ? (
          <InstitutionSectionCard title="Cora policy" hint="Institution-level usage thresholds — platform safety rules cannot be overridden">
            <InstitutionKeyValueList
              rows={[
                {
                  label: "Warning thresholds",
                  value: (data.cora.warningThresholds as number[]).map((t) => `${t}%`).join(", "),
                },
                { label: "Hard limit at allowance", value: data.cora.hardLimit ? "Enabled" : "Disabled" },
              ]}
            />
          </InstitutionSectionCard>
        ) : null}

        {section === "notifications" ? (
          <InstitutionSectionCard title="Notifications">
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              Email and in-app alerts for license capacity, Cora usage, renewals, and invoices will appear here as notification delivery is configured for your institution.
            </p>
          </InstitutionSectionCard>
        ) : null}
      </FacultyModuleSplitLayout>
    </InstitutionModulePage>
  )
}
