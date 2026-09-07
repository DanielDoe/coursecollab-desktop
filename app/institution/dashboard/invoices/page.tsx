"use client"

import { useMemo, useState } from "react"
import { Calendar, CheckCircle2, FileText, Wallet } from "lucide-react"
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

type InvoicesPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/billing").getInstitutionInvoicesModule>>

function invoiceTone(status: string): "success" | "warning" | "danger" | "muted" | "info" {
  const s = status.toLowerCase()
  if (s === "paid") return "success"
  if (s === "overdue") return "danger"
  if (s === "due" || s === "sent" || s === "issued") return "warning"
  if (s === "void" || s === "draft") return "muted"
  return "info"
}

export default function InstitutionInvoicesPage() {
  const { data, loading, error } = useInstitutionJson<InvoicesPayload>("/api/institution/invoices")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.invoices ?? []).filter((inv) => {
      if (statusFilter !== "all" && inv.status.toLowerCase() !== statusFilter) return false
      if (!q) return true
      return inv.number.toLowerCase().includes(q) || (inv.poNumber?.toLowerCase().includes(q) ?? false)
    })
  }, [data?.invoices, search, statusFilter])

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  const k = data?.kpis

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        {k ? (
          <InstitutionKpiGrid
            items={[
              { label: "Total invoiced", value: k.totalInvoiced ?? "—", sub: "This contract", icon: FileText },
              { label: "Amount paid", value: k.amountPaid ?? "—", sub: "Received payments", icon: CheckCircle2 },
              { label: "Outstanding", value: k.outstanding ?? "—", sub: "Balance due", icon: Wallet },
              { label: "Next due date", value: k.nextDueDate ?? "—", sub: "Upcoming invoice", icon: Calendar },
            ]}
          />
        ) : null}

        <InstitutionSectionCard title="Invoices">
          <InstitutionToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search invoice # or PO…"
            filters={
              <select
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {["paid", "due", "overdue", "sent", "issued", "void"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            }
          />
          <InstitutionDataTable
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <InstitutionEmptyState
                title="No invoices issued"
                body="Financial documents for your institutional contract will appear here when billing is configured."
              />
            }
            columns={[
              { key: "number", label: "Invoice #" },
              { key: "date", label: "Date", render: (r) => r.issueDate ?? "—" },
              { key: "desc", label: "Description", render: (r) => r.description },
              { key: "po", label: "PO #", render: (r) => r.poNumber ?? "—" },
              { key: "amount", label: "Amount", render: (r) => r.amount ?? "—" },
              { key: "due", label: "Due", render: (r) => r.dueDate ?? "—" },
              {
                key: "status",
                label: "Status",
                render: (r) => <InstitutionStatusBadge label={r.status} tone={invoiceTone(r.status)} />,
              },
              { key: "paid", label: "Payment date", render: (r) => r.paymentDate ?? "—" },
              {
                key: "actions",
                label: "",
                render: (r) =>
                  r.documentUrl ? (
                    <a href={r.documentUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-[var(--cc-accent-dark)]">
                      Download
                    </a>
                  ) : null,
              },
            ]}
          />
        </InstitutionSectionCard>
      </div>
    </InstitutionModulePage>
  )
}
