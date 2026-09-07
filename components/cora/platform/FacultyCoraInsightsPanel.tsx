"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { fetchFacultyCoraInsights, type FacultyCoraInsight } from "@/lib/cora/faculty-cora-client"
import type { FacultyCoraCapability } from "@/lib/cora/faculty-capabilities"

type Props = {
  initialInsights?: FacultyCoraInsight[]
  capabilities: FacultyCoraCapability[]
  onStartCapability: (capability: FacultyCoraCapability, prompt?: string) => void
}

function severityIcon(severity?: FacultyCoraInsight["severity"]) {
  if (severity === "warning") return AlertTriangle
  if (severity === "success") return CheckCircle2
  return Info
}

export function FacultyCoraInsightsPanel({
  initialInsights = [],
  capabilities,
  onStartCapability,
}: Props) {
  const [insights, setInsights] = useState(initialInsights)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchFacultyCoraInsights()
      setInsights(res.insights ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialInsights.length === 0) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void refresh()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      {insights.length === 0 && !loading ? (
        <CardWrapper variant="inner" hover={false}>
          <div className="p-6 text-sm text-[var(--cc-text-muted)]">
            No insights yet. Once students use Cora or submit assessments, recommendations will appear here.
          </div>
        </CardWrapper>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = severityIcon(insight.severity)
            const capability = capabilities.find((c) => c.id === insight.capabilityId)
            return (
              <CardWrapper key={insight.id || `insight-${index}`} variant="inner" hover={false}>
                <div className="flex items-start gap-3 p-4">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--cc-text)]">{insight.title}</p>
                    <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{insight.body}</p>
                    {capability ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3 rounded-xl"
                        onClick={() =>
                          onStartCapability(capability, `Help me act on this insight: ${insight.title}. ${insight.body}`)
                        }
                      >
                        Ask Cora to help
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardWrapper>
            )
          })}
        </div>
      )}
    </div>
  )
}
