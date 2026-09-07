"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RECOMMENDATION_DELIVERY_OPTIONS, type RecommendationDeliveryMethod } from "@/lib/recommendation-delivery"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

type Props = {
  requestId: string
  deliveryMethod: RecommendationDeliveryMethod
  designatedRecipientEmail?: string | null
  briefMarkdown?: string | null
  onUpdated?: () => void
}

export function InstructorRecommendationBriefDelivery({
  requestId,
  deliveryMethod,
  designatedRecipientEmail,
  briefMarkdown,
  onUpdated,
}: Props) {
  const [method, setMethod] = useState<RecommendationDeliveryMethod>(deliveryMethod)
  const [email, setEmail] = useState(designatedRecipientEmail ?? "")
  const [busy, setBusy] = useState(false)

  async function saveDelivery() {
    setBusy(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/recommendations/${requestId}`, {
        method: "PATCH",
        headers: buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "set_delivery_method",
          deliveryMethod: method,
          designatedRecipientEmail: method === "designated_recipient" ? email : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || "Failed")
      }
      onUpdated?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-4">
      {briefMarkdown?.trim() ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Student recommendation brief
          </p>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 dark:bg-slate-950/40 p-3 text-xs text-slate-800 dark:text-slate-200">
            {briefMarkdown}
          </pre>
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No student brief yet — they can generate one after completing their questionnaire.
        </p>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Delivery method</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as RecommendationDeliveryMethod)}>
          <SelectTrigger className="rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECOMMENDATION_DELIVERY_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {RECOMMENDATION_DELIVERY_OPTIONS.find((o) => o.id === method)?.description}
        </p>
        {method === "designated_recipient" ? (
          <Input
            type="email"
            className="rounded-xl h-10"
            placeholder="recipient@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : null}
        <Button type="button" size="sm" className="rounded-xl" disabled={busy} onClick={() => void saveDelivery()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save delivery settings
        </Button>
      </div>
    </div>
  )
}
