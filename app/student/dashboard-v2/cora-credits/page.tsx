"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Crown, Sparkles, Zap } from "lucide-react"
import { CoraCreditPacksPanel } from "@/components/cora/CoraCreditPacksPanel"
import { CoraUsageHistory } from "@/components/cora/CoraUsageHistory"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { resolveStudentDatabaseId } from "@/lib/auth"
import { fetchCoraCreditsBalance } from "@/lib/cora/credits-client"
import { Button } from "@/components/ui/button"

type Balance = {
  credits: number
  includedBalance: number
  purchasedBalance: number
  includedCapHint: number
  membershipTier: string | null
  nextReset: string | null
  warning: string | null
  coraMode: "premium" | "lite"
  month?: { creditsUsed: number; byFeature?: { feature: string; credits: number }[] }
}

const FEATURE_LABELS: Record<string, string> = {
  chat: "Cora Chat",
  walkthrough: "Interactive Walkthroughs",
  agent: "Agent Actions",
  codebench: "CodeBench",
  notes: "Notes/Flashcards",
  flashcards: "Notes/Flashcards",
  other: "Other",
}

function featureLabel(key: string) {
  const k = key.toLowerCase()
  for (const [id, label] of Object.entries(FEATURE_LABELS)) {
    if (k.includes(id)) return label
  }
  return key.replace(/_/g, " ")
}

export default function StudentCoraCreditsPage() {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)

  useEffect(() => {
    const id = resolveStudentDatabaseId()
    setStudentId(id)
    if (!id) return
    void fetchCoraCreditsBalance("student", id)
      .then((r) => r.json())
      .then((data) => setBalance(data))
      .catch(() => setBalance(null))
  }, [])

  const resetLabel = balance?.nextReset
    ? new Date(balance.nextReset).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "—"

  return (
    <div className="w-full min-w-0 space-y-4 p-4 sm:p-5 pb-10">
      <EmbedModuleCard>
        <div className="p-4 sm:p-5 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">Cora Credits</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Included credits reset monthly. Purchased credits do not expire with your monthly
              allowance reset.
            </p>
          </div>

          {balance?.warning && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {balance.warning}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Premium credits remaining"
              value={(balance?.credits ?? 0).toLocaleString()}
              icon={Zap}
            />
            <Stat
              label="Included this month"
              value={(balance?.includedCapHint ?? 0).toLocaleString()}
              icon={Sparkles}
            />
            <Stat
              label="Purchased credits"
              value={(balance?.purchasedBalance ?? 0).toLocaleString()}
              icon={Crown}
            />
            <Stat label="Next allowance reset" value={resetLabel} icon={Calendar} />
            <Stat label="Current plan" value={balance?.membershipTier ?? "Scholar"} icon={Crown} />
            <Stat
              label="Mode"
              value={balance?.coraMode === "lite" ? "Cora Lite" : "Cora Premium"}
              icon={Sparkles}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">Usage this period</h2>
            <div className="space-y-2">
              {(balance?.month?.byFeature ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No Cora usage yet this period.</p>
              ) : (
                (balance?.month?.byFeature ?? []).map((row) => (
                  <div
                    key={row.feature}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span>{featureLabel(row.feature)}</span>
                    <span className="tabular-nums text-muted-foreground">−{row.credits}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {balance?.coraMode === "lite" && (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href="#add-cora-credits">Add Cora Credits</a>
              </Button>
              <Button asChild variant="outline">
                <Link href="/student/dashboard-v2/ai-tutor">Continue with Cora Lite</Link>
              </Button>
            </div>
          )}
        </div>
      </EmbedModuleCard>

      <div id="add-cora-credits">
        <CoraCreditPacksPanel
          audience="student"
          buyerId={studentId}
          title="Add Cora Credits"
          subtitle="Purchased credits do not expire with your monthly allowance reset."
        />
      </div>

      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <CoraUsageHistory userId={studentId} role="student" />
        </div>
      </EmbedModuleCard>
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Zap
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
