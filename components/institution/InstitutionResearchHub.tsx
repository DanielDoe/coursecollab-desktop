"use client"

import { useCallback, useEffect, useState } from "react"
import { InstitutionChartCard, NamedBarChart } from "@/components/institution/institution-charts"
import { CapabilityAuditTable, InsufficientMetric } from "@/components/institution/InstitutionResearchUi"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import {
  COHORT_DEFINITIONS,
  COHORT_ROLES,
  OUTCOME_METRICS,
  STUDY_DESIGNS,
  type ResearchExportLog,
  type ResearchStudy,
} from "@/lib/institutions/research/study-types"

type Workspace = {
  studies: ResearchStudy[]
  selectedStudyId: number | null
  comparison: {
    study: ResearchStudy
    outcomeMetric: ResearchStudy["outcomeMetric"]
    groups: Array<{
      cohort: ResearchStudy["cohorts"][number]
      n: number
      stats: {
        n: number
        mean: number | null
        median: number | null
        sd: number | null
        min: number | null
        max: number | null
        insufficient: boolean
      }
    }>
    contrast: { available: boolean; meanDiff: number | null; cohensD: number | null; note: string } | null
    causalEligible: boolean
    designNote: string
    cellMinimum: number
  } | null
  exports: ResearchExportLog[]
  cellMinimum: number
  exportReady: boolean
  note: string
}

const FIELD = "h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
const BTN = "h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium"
const CTA = "h-9 rounded-lg bg-[var(--foreground)] px-3 text-sm font-medium text-[var(--background)]"

const DESIGN_LABEL: Record<(typeof STUDY_DESIGNS)[number], string> = {
  observational: "Observational",
  comparison: "Group comparison",
  pre_post: "Pre / post",
  authorized_experiment: "Authorized experiment",
}

const OUTCOME_LABEL: Record<(typeof OUTCOME_METRICS)[number], string> = {
  assessment_score: "Assessment score",
  practice_accuracy: "Practice accuracy",
  cora_sessions: "Cora sessions",
}

const DEF_LABEL: Record<(typeof COHORT_DEFINITIONS)[number], string> = {
  roster: "Covered roster",
  cora: "Cora users in window",
  no_cora: "No Cora in window",
  practice: "Practice activity",
  assessment: "Completed assessments",
  independent: "Independent-tagged attempts",
}

function fmt(v: number | null | undefined, suffix = "") {
  if (v == null) return "Insufficient data"
  return `${v}${suffix}`
}

export function InstitutionResearchHub() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [studyId, setStudyId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [design, setDesign] = useState<(typeof STUDY_DESIGNS)[number]>("observational")
  const [outcome, setOutcome] = useState<(typeof OUTCOME_METRICS)[number]>("assessment_score")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [authNote, setAuthNote] = useState("")
  const [cohortName, setCohortName] = useState("")
  const [cohortDef, setCohortDef] = useState<(typeof COHORT_DEFINITIONS)[number]>("cora")
  const [cohortRole, setCohortRole] = useState<(typeof COHORT_ROLES)[number]>("group")
  const [preQuizId, setPreQuizId] = useState("")
  const [postQuizId, setPostQuizId] = useState("")
  const [maxScore, setMaxScore] = useState("")
  const [surveyName, setSurveyName] = useState("")
  const [surveyConstruct, setSurveyConstruct] = useState("cognitive_engagement")
  const [surveyJson, setSurveyJson] = useState("")
  const [equityJson, setEquityJson] = useState("")
  const [configMsg, setConfigMsg] = useState<string | null>(null)

  const load = useCallback(async (id?: number | null) => {
    setError(null)
    const q = id ? `?studyId=${id}` : ""
    const res = await fetch(`/api/institution/research${q}`, { credentials: "include", cache: "no-store" })
    const body = (await res.json().catch(() => ({}))) as Workspace & { error?: string }
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
    setWorkspace(body)
    setStudyId(body.selectedStudyId)
    return body
  }, [])

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load research"))
  }, [load])

  async function mutate(payload: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/institution/research", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => ({}))) as Workspace & { error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      setWorkspace(body)
      setStudyId(body.selectedStudyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  async function configPost(path: string, payload: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    setConfigMsg(null)
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean; imported?: number; instrumentId?: number }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      if (body.imported != null) setConfigMsg(`Imported ${body.imported} row(s).`)
      else if (body.instrumentId) setConfigMsg(`Instrument saved (ID ${body.instrumentId}).`)
      else setConfigMsg("Saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Configuration failed")
    } finally {
      setBusy(false)
    }
  }

  const selected: ResearchStudy | null =
    workspace?.studies.find((s) => s.id === studyId) ?? workspace?.studies[0] ?? null
  const comparison = workspace?.comparison
  const chartData =
    comparison?.groups
      .filter((g) => !g.stats.insufficient && g.stats.mean != null)
      .map((g) => ({ key: String(g.cohort.id), name: g.cohort.name, value: g.stats.mean as number })) ?? []

  return (
    <div className="space-y-4">
      <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
        {workspace?.note ??
          "Studies record a design. They do not assign treatments or change a learner experience. Exports use de-identified research IDs."}
      </p>
      {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}

      <InstitutionChartCard title="Study builder" hint="Drafts stay observational until you add cohorts">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            void mutate({
              action: "create_study",
              name,
              design,
              outcomeMetric: outcome,
              fromDate: fromDate || null,
              toDate: toDate || null,
              authorizationNote: authNote || null,
            }).then(() => {
              setName("")
              setAuthNote("")
            })
          }}
        >
          <label className="block text-xs">
            <span className={PORTAL_TEXT_MUTED}>Name</span>
            <input className={cn(FIELD, "mt-1")} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block text-xs">
            <span className={PORTAL_TEXT_MUTED}>Design</span>
            <select className={cn(FIELD, "mt-1")} value={design} onChange={(e) => setDesign(e.target.value as typeof design)}>
              {STUDY_DESIGNS.map((d) => (
                <option key={d} value={d}>
                  {DESIGN_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className={PORTAL_TEXT_MUTED}>Outcome</span>
            <select className={cn(FIELD, "mt-1")} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
              {OUTCOME_METRICS.map((m) => (
                <option key={m} value={m}>
                  {OUTCOME_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className={PORTAL_TEXT_MUTED}>From</span>
              <input className={cn(FIELD, "mt-1")} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </label>
            <label className="block text-xs">
              <span className={PORTAL_TEXT_MUTED}>To</span>
              <input className={cn(FIELD, "mt-1")} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs sm:col-span-2">
            <span className={PORTAL_TEXT_MUTED}>Authorization / IRB note (required for authorized experiment)</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
              value={authNote}
              onChange={(e) => setAuthNote(e.target.value)}
            />
          </label>
          <p className={cn("text-xs sm:col-span-2", PORTAL_TEXT_MUTED)}>
            Experimental assignment will never silently change a learner experience from this screen.
          </p>
          <div>
            <button type="submit" className={CTA} disabled={busy || !name.trim()}>
              Create study
            </button>
          </div>
        </form>
      </InstitutionChartCard>

      {workspace && workspace.studies.length > 0 ? (
        <InstitutionChartCard title="Studies">
          <div className="flex flex-wrap gap-2">
            {workspace.studies.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cn(BTN, s.id === selected?.id && "ring-2 ring-[var(--foreground)]")}
                onClick={() => {
                  setStudyId(s.id)
                  void load(s.id).catch((err) => setError(err instanceof Error ? err.message : "Failed"))
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
          {selected ? (
            <div className={cn("mt-4 space-y-1 text-sm", PORTAL_TEXT)}>
              <p>
                <span className={PORTAL_TEXT_MUTED}>Design · </span>
                {DESIGN_LABEL[selected.design]} · {selected.status}
              </p>
              <p>
                <span className={PORTAL_TEXT_MUTED}>Outcome · </span>
                {OUTCOME_LABEL[selected.outcomeMetric]}
                {selected.fromDate || selected.toDate
                  ? ` · ${selected.fromDate ?? "…"} → ${selected.toDate ?? "…"}`
                  : " · last 30 days"}
              </p>
              <button
                type="button"
                className={cn(BTN, "mt-2")}
                disabled={busy}
                onClick={() => void mutate({ action: "delete_study", studyId: selected.id })}
              >
                Delete study
              </button>
            </div>
          ) : null}
        </InstitutionChartCard>
      ) : (
        <InsufficientMetric
          title="Studies"
          reason="No study is configured yet."
          unblock="Create a study, then add at least two cohorts before a group contrast can be computed."
        />
      )}

      {selected ? (
        <InstitutionChartCard title="Cohorts" hint="Definitions are activity filters, not random assignment">
          <ul className="divide-y divide-[var(--border)]">
            {selected.cohorts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{c.name}</span>
                  <span className={cn("ml-2 text-xs", PORTAL_TEXT_MUTED)}>
                    {c.roleInStudy} · {DEF_LABEL[c.definitionType]}
                  </span>
                </span>
                <button
                  type="button"
                  className={BTN}
                  disabled={busy}
                  onClick={() => void mutate({ action: "remove_cohort", studyId: selected.id, cohortId: c.id })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 grid gap-2 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault()
              void mutate({
                action: "add_cohort",
                studyId: selected.id,
                name: cohortName,
                definitionType: cohortDef,
                roleInStudy: cohortRole,
              }).then(() => setCohortName(""))
            }}
          >
            <input className={FIELD} placeholder="Cohort name" value={cohortName} onChange={(e) => setCohortName(e.target.value)} required />
            <select className={FIELD} value={cohortDef} onChange={(e) => setCohortDef(e.target.value as typeof cohortDef)}>
              {COHORT_DEFINITIONS.map((d) => (
                <option key={d} value={d}>
                  {DEF_LABEL[d]}
                </option>
              ))}
            </select>
            <select className={FIELD} value={cohortRole} onChange={(e) => setCohortRole(e.target.value as typeof cohortRole)}>
              {COHORT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button type="submit" className={CTA} disabled={busy || !cohortName.trim()}>
              Add cohort
            </button>
          </form>
        </InstitutionChartCard>
      ) : null}

      {comparison ? (
        <InstitutionChartCard title="Group comparison" hint={comparison.designNote}>
          {comparison.study.design === "pre_post" ? (
            <div className="space-y-3">
              <InsufficientMetric
                title="Pre/post learning gain"
                reason="Link instruments to compute gain"
                unblock="Enter pre and post quiz IDs for the selected study below. Gain appears when ≥10 learners have paired scores."
              />
              {selected ? (
                <form
                  className="grid gap-2 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void configPost("/api/institution/research/instruments", {
                      studyId: selected.id,
                      preQuizId: Number(preQuizId),
                      postQuizId: Number(postQuizId),
                      maxScore: maxScore ? Number(maxScore) : undefined,
                    })
                  }}
                >
                  <input className={FIELD} placeholder="Pre quiz ID" value={preQuizId} onChange={(e) => setPreQuizId(e.target.value)} required />
                  <input className={FIELD} placeholder="Post quiz ID" value={postQuizId} onChange={(e) => setPostQuizId(e.target.value)} required />
                  <input className={FIELD} placeholder="Max score (optional)" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                  <button type="submit" className={CTA} disabled={busy || !preQuizId || !postQuizId}>
                    Link pre/post quizzes
                  </button>
                </form>
              ) : null}
            </div>
          ) : comparison.groups.length < 2 ? (
            <InsufficientMetric
              title="Group contrast"
              reason="Need two cohorts"
              unblock="Add a second cohort (for example Cora users and no Cora). That split is observational, not causal."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
                      <th className="py-2 pr-3">Cohort</th>
                      <th className="py-2 pr-3">N</th>
                      <th className="py-2 pr-3">Mean</th>
                      <th className="py-2 pr-3">Median</th>
                      <th className="py-2 pr-3">SD</th>
                      <th className="py-2">Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {comparison.groups.map((g) => (
                      <tr key={g.cohort.id}>
                        <td className="py-2 pr-3 font-medium">{g.cohort.name}</td>
                        <td className="py-2 pr-3 tabular-nums">{g.n}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmt(g.stats.mean)}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmt(g.stats.median)}</td>
                        <td className="py-2 pr-3 tabular-nums">{fmt(g.stats.sd)}</td>
                        <td className="py-2 tabular-nums">
                          {g.stats.insufficient ? "—" : `${g.stats.min}–${g.stats.max}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] p-3.5">
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Mean difference</p>
                  <p className={cn("mt-2 text-2xl font-semibold tabular-nums", comparison.contrast?.available ? PORTAL_TEXT : PORTAL_TEXT_MUTED)}>
                    {fmt(comparison.contrast?.meanDiff)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] p-3.5">
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Cohen&apos;s d</p>
                  <p className={cn("mt-2 text-2xl font-semibold tabular-nums", comparison.contrast?.available ? PORTAL_TEXT : PORTAL_TEXT_MUTED)}>
                    {fmt(comparison.contrast?.cohensD)}
                  </p>
                  <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Descriptive effect size</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] p-3.5">
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Causal claim</p>
                  <p className={cn("mt-2 text-sm font-medium", PORTAL_TEXT)}>
                    {comparison.causalEligible ? "Authorized design recorded" : "Not eligible"}
                  </p>
                  <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                    AI user vs non-user is never treated as a causal estimate.
                  </p>
                </div>
              </div>
              <p className={cn("mt-3 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{comparison.contrast?.note}</p>
              {chartData.length > 0 ? (
                <div className="mt-4">
                  <NamedBarChart data={chartData} empty="—" valueLabel="Mean" />
                </div>
              ) : null}
            </>
          )}
        </InstitutionChartCard>
      ) : null}

      {selected ? (
        <InstitutionChartCard
          title="Research instruments & equity imports"
          hint="Pre/post quizzes, validated survey scores, and authorized equity attributes. No fabricated values — metrics activate when N thresholds are met."
        >
          {configMsg ? <p className={cn("text-sm", PORTAL_TEXT)}>{configMsg}</p> : null}
          <div className="grid gap-4 lg:grid-cols-3">
            <form
              className="space-y-2 rounded-xl border border-[var(--border)] p-3"
              onSubmit={(e) => {
                e.preventDefault()
                void configPost("/api/institution/research/instruments", {
                  studyId: selected.id,
                  preQuizId: Number(preQuizId),
                  postQuizId: Number(postQuizId),
                  maxScore: maxScore ? Number(maxScore) : undefined,
                })
              }}
            >
              <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Pre/post instruments</p>
              <input className={FIELD} placeholder="Pre quiz ID" value={preQuizId} onChange={(e) => setPreQuizId(e.target.value)} />
              <input className={FIELD} placeholder="Post quiz ID" value={postQuizId} onChange={(e) => setPostQuizId(e.target.value)} />
              <input className={FIELD} placeholder="Max score" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
              <button type="submit" className={BTN} disabled={busy || !preQuizId || !postQuizId}>
                Save for study {selected.id}
              </button>
            </form>
            <form
              className="space-y-2 rounded-xl border border-[var(--border)] p-3"
              onSubmit={(e) => {
                e.preventDefault()
                try {
                  const parsed = JSON.parse(surveyJson || "{}") as {
                    action?: string
                    instrumentId?: number
                    name?: string
                    construct?: string
                    scaleMin?: number
                    scaleMax?: number
                    responses?: Array<{ studentId: number; courseId?: number; totalScore: number }>
                  }
                  if (parsed.action === "import_responses" && parsed.instrumentId) {
                    void configPost("/api/institution/research/surveys", parsed)
                  } else {
                    void configPost("/api/institution/research/surveys", {
                      name: surveyName || parsed.name || "Imported instrument",
                      construct: surveyConstruct || parsed.construct,
                      scaleMin: parsed.scaleMin,
                      scaleMax: parsed.scaleMax,
                      itemCount: (parsed as { itemCount?: number }).itemCount,
                      sourceCitation: (parsed as { sourceCitation?: string }).sourceCitation,
                    })
                  }
                } catch {
                  setError("Survey JSON is invalid")
                }
              }}
            >
              <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Survey constructs</p>
              <input className={FIELD} placeholder="Instrument name" value={surveyName} onChange={(e) => setSurveyName(e.target.value)} />
              <select className={FIELD} value={surveyConstruct} onChange={(e) => setSurveyConstruct(e.target.value)}>
                <option value="cognitive_engagement">Cognitive engagement</option>
                <option value="self_regulated_learning">Self-regulated learning</option>
                <option value="ai_trust">AI trust</option>
                <option value="cognitive_load">Cognitive load</option>
              </select>
              <textarea
                className={cn(FIELD, "min-h-[72px] py-2")}
                placeholder='Optional JSON: {"action":"import_responses","instrumentId":1,"responses":[...]}'
                value={surveyJson}
                onChange={(e) => setSurveyJson(e.target.value)}
              />
              <button type="submit" className={BTN} disabled={busy}>
                Save / import survey
              </button>
            </form>
            <form
              className="space-y-2 rounded-xl border border-[var(--border)] p-3"
              onSubmit={(e) => {
                e.preventDefault()
                try {
                  const rows = JSON.parse(equityJson || "[]") as Array<{ studentId: number; attributeKey: string; attributeValue: string }>
                  void configPost("/api/institution/research/equity", { rows })
                } catch {
                  setError("Equity JSON must be a valid array")
                }
              }}
            >
              <p className={cn("text-xs font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>Equity attributes</p>
              <textarea
                className={cn(FIELD, "min-h-[120px] py-2 font-mono text-xs")}
                placeholder='[{"studentId":1,"attributeKey":"first_gen","attributeValue":"yes"}]'
                value={equityJson}
                onChange={(e) => setEquityJson(e.target.value)}
                required
              />
              <button type="submit" className={BTN} disabled={busy || !equityJson.trim()}>
                Import attributes
              </button>
            </form>
          </div>
        </InstitutionChartCard>
      ) : null}

      {selected ? (
        <InstitutionChartCard title="Research exports" hint="De-identified research IDs only. Names and emails are never included.">
          <div className="flex flex-wrap gap-2">
            <a className={CTA} href={`/api/institution/research/export?studyId=${selected.id}&dataset=summary`}>
              Download summary CSV
            </a>
            <a className={BTN} href={`/api/institution/research/export?studyId=${selected.id}&dataset=summary&format=xlsx`}>
              Download summary XLSX
            </a>
            <a className={BTN} href={`/api/institution/research/export?studyId=${selected.id}&dataset=outcomes`}>
              Download outcomes CSV
            </a>
            <a className={BTN} href={`/api/institution/research/export?studyId=${selected.id}&dataset=outcomes&format=xlsx`}>
              Download outcomes XLSX
            </a>
            <a className={BTN} href={`/api/institution/research/export?studyId=${selected.id}&dataset=summary&format=json`}>
              Download summary JSON
            </a>
            <a className={BTN} href="/api/institution/research/export?dataset=mixed_effects&preset=last_30_days">
              Download mixed-effects CSV
            </a>
            <a className={BTN} href="/api/institution/research/export?dataset=mixed_effects&preset=last_30_days&format=xlsx">
              Download mixed-effects XLSX
            </a>
          </div>
          {workspace && workspace.exports.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
              {workspace.exports.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {row.dataset}
                    {row.studyId ? ` · study ${row.studyId}` : ""}
                  </span>
                  <span className={cn("tabular-nums", PORTAL_TEXT_MUTED)}>
                    {row.rowCount ?? 0} rows · {String(row.createdAt).slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("mt-3 text-sm", PORTAL_TEXT_MUTED)}>No exports logged yet.</p>
          )}
        </InstitutionChartCard>
      ) : null}

      <InstitutionChartCard title="Capability">
        <CapabilityAuditTable domain="research" />
      </InstitutionChartCard>
    </div>
  )
}
