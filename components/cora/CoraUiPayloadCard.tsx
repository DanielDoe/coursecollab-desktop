"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CoraActionCard } from "@/components/cora/CoraActionCard"
import { CoraMathText } from "@/components/cora/CoraMathText"
import type { CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"
import type {
  CoraLecturePackData,
  CoraQuestionPreviewItem,
  CoraUiPayload,
  CoraWalkthroughStepPayload,
} from "@/lib/cora/models/ui-payloads"
import { cn } from "@/lib/utils"

type Portal = "faculty" | "student"

type Props = {
  ui: CoraUiPayload
  portal?: Portal
  className?: string
  onApplyCode?: (next: string) => void
  applyDiff?: (diff: string) => string | null
}

const PROGRESS_ROUTES: Record<string, string> = {
  practice: "/student/dashboard-v2/practice",
  flashcards: "/student/dashboard-v2/flashcards",
  calendar: "/student/dashboard-v2/calendar",
}

async function saveDraft(portal: Portal, kind: string, title: string, payload: Record<string, unknown>) {
  const path = portal === "faculty" ? "/api/instructor/cora/drafts" : "/api/cora/drafts"
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ kind, title, payload }),
  })
  const data = (await res.json().catch(() => ({}))) as { draft?: { id: number }; error?: string }
  if (!res.ok || !data.draft) throw new Error(data.error || "Could not keep this draft.")
  return data.draft
}

async function proposeDraft(portal: Portal, id: number) {
  const path =
    portal === "faculty"
      ? `/api/instructor/cora/drafts/${id}/propose`
      : `/api/cora/drafts/${id}/propose`
  const res = await fetch(path, { method: "POST", credentials: "include" })
  const data = (await res.json().catch(() => ({}))) as { proposal?: CoraActionProposal; error?: string }
  if (!res.ok || !data.proposal) throw new Error(data.error || "This draft stays on the shelf until it can be confirmed.")
  return data.proposal
}

function choiceMatchesAnswer(choice: string, answer: string, index: number): boolean {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")
  const picked = norm(choice)
  const expected = norm(answer)
  if (!picked || !expected) return false
  if (picked === expected) return true
  const letter = String.fromCharCode(97 + index)
  if (expected === letter) return true
  return picked.startsWith(`${expected})`) || picked.startsWith(`${expected}.`) || picked.startsWith(`${expected} `)
}

function ChoiceRadios({
  name,
  prompt,
  choices,
  answer,
}: {
  name: string
  prompt: string
  choices: string[]
  answer?: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const pickedIndex = choices.findIndex((choice) => choice === picked)
  const isCorrect =
    picked != null && answer ? choiceMatchesAnswer(picked, answer, Math.max(0, pickedIndex)) : null

  return (
    <div className="mt-3 space-y-2">
      <CoraMathText text={prompt} compact className="text-sm font-medium text-[var(--cc-text)]" />
      <RadioGroup
        value={picked ?? ""}
        onValueChange={setPicked}
        className="gap-2"
        aria-label={prompt}
      >
        {choices.map((choice, index) => {
          const id = `${name}-${index}`
          return (
            <label
              key={id}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm",
                picked === choice ? "border-[var(--cc-accent)] bg-[var(--muted)]/40" : "border-[var(--border)]",
              )}
            >
              <RadioGroupItem value={choice} id={id} className="mt-0.5" />
              <CoraMathText text={choice} compact className="min-w-0 flex-1 text-sm text-[var(--cc-text)]" />
            </label>
          )
        })}
      </RadioGroup>
      {picked == null ? (
        <p className="text-xs text-[var(--cc-text-muted)]">Choose an option to continue.</p>
      ) : isCorrect == null ? null : isCorrect ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">That matches this item.</p>
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-300">Not this one. Pick another option.</p>
      )}
    </div>
  )
}

function Shell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 [overflow-anchor:none]", className)}>
      {children}
    </div>
  )
}

function WalkthroughCard({ ui }: { ui: Extract<CoraUiPayload, { type: "walkthrough" }> }) {
  const [index, setIndex] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const step = ui.steps[index] as CoraWalkthroughStepPayload | undefined
  if (!step) return null
  const hintText = hintLevel === 0 ? "" : hintLevel === 1 ? "Name the given and the quantity this step needs." : step.hint
  const selectedOption = step.checkpoint?.options.find((option) => option.id === picked) ?? null
  const waitingForChoice = Boolean(step.checkpoint?.options.length) && !picked
  return (
    <Shell>
      <p className="text-sm font-semibold text-[var(--cc-text)]">{ui.title}</p>
      {ui.objective ? <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{ui.objective}</p> : null}
      <p className="mt-3 text-xs text-[var(--cc-text-muted)]">
        Step {index + 1} of {ui.steps.length}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--cc-text)]">{step.title}</p>
      <CoraMathText text={step.explanation} className="mt-1 text-sm leading-relaxed text-[var(--cc-text)]" />
      {step.equation ? (
        <div className="mt-3 overflow-x-auto rounded-xl bg-[var(--muted)]/40 px-3 py-2">
          <CoraMathText text={step.equation} display align="center" compact className="text-sm" />
        </div>
      ) : null}
      {step.code ? (
        <pre className="mt-3 overflow-x-auto rounded-xl bg-[var(--muted)]/40 px-3 py-2 text-xs">{step.code}</pre>
      ) : null}
      {step.checkpoint ? (
        <div className="mt-3 space-y-2">
          <CoraMathText text={step.checkpoint.prompt} compact className="text-sm font-medium text-[var(--cc-text)]" />
          <RadioGroup
            value={picked ?? ""}
            onValueChange={setPicked}
            className="gap-2"
            aria-label={step.checkpoint.prompt}
          >
            {step.checkpoint.options.map((option) => {
              const id = `${step.id}-${step.checkpoint?.id ?? "checkpoint"}-${option.id}`
              return (
                <label
                  key={option.id}
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm",
                    picked === option.id ? "border-[var(--cc-accent)] bg-[var(--muted)]/40" : "border-[var(--border)]",
                  )}
                >
                  <RadioGroupItem value={option.id} id={id} className="mt-0.5" />
                  <CoraMathText text={option.label} compact className="min-w-0 flex-1 text-sm text-[var(--cc-text)]" />
                </label>
              )
            })}
          </RadioGroup>
          {waitingForChoice ? (
            <p className="text-xs text-[var(--cc-text-muted)]">Choose an option to continue.</p>
          ) : selectedOption ? (
            <CoraMathText
              text={
                selectedOption.feedback ||
                (selectedOption.correct ? "That matches this step." : "Not this one. Pick another option.")
              }
              compact
              className={cn(
                "text-xs",
                selectedOption.correct
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            />
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setHintLevel((level) => Math.min(2, level + 1))}>
          Hint
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={index === 0} onClick={() => { setIndex((value) => value - 1); setHintLevel(0); setPicked(null) }}>
          Back
        </Button>
        <Button type="button" size="sm" className="rounded-full" disabled={waitingForChoice || index >= ui.steps.length - 1} onClick={() => { setIndex((value) => value + 1); setHintLevel(0); setPicked(null) }}>
          Next step
        </Button>
      </div>
      {step.hintBlocked ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Hint blocked — it would give away a live assessment.</p>
      ) : hintText ? (
        <CoraMathText text={hintText} compact className="mt-2 text-xs text-[var(--cc-text-muted)]" />
      ) : null}
    </Shell>
  )
}

function QuestionCard({
  ui,
  portal,
}: {
  ui: Extract<CoraUiPayload, { type: "question_preview" }>
  portal: Portal
}) {
  const [index, setIndex] = useState(0)
  const [items, setItems] = useState(ui.data.items)
  const [proposal, setProposal] = useState<CoraActionProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const item = items[index]
  if (!item) return null

  function update(patch: Partial<CoraQuestionPreviewItem>) {
    setItems((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  async function accept() {
    if (portal !== "faculty") return
    setBusy(true)
    setNote("")
    try {
      const draft = await saveDraft(portal, "question", item.stem.slice(0, 80), { ...item })
      setProposal(await proposeDraft(portal, draft.id))
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not prepare the confirm card.")
    } finally {
      setBusy(false)
    }
  }

  if (portal === "student") {
    return (
      <Shell>
        <p className="text-sm text-[var(--cc-text)]">{ui.message}</p>
        <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
          Item {index + 1} of {items.length}
        </p>
        <CoraMathText text={item.stem} className="mt-3 text-sm leading-relaxed text-[var(--cc-text)]" />
        {item.choices.length ? (
          <ChoiceRadios
            key={item.id}
            name={item.id}
            prompt="Choose one"
            choices={item.choices}
            answer={item.answer}
          />
        ) : (
          <p className="mt-2 text-xs text-[var(--cc-text-muted)]">No choices were attached to this item.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
            Previous
          </Button>
          <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={index >= items.length - 1} onClick={() => setIndex((value) => value + 1)}>
            Next
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <p className="text-sm text-[var(--cc-text)]">{ui.message}</p>
      <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
        Item {index + 1} of {items.length}
      </p>
      <label className="mt-3 block text-xs text-[var(--cc-text-muted)]">
        Stem
        <textarea
          value={item.stem}
          onChange={(event) => update({ stem: event.target.value })}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--cc-text)]"
          rows={3}
        />
      </label>
      {item.choices.map((choice, choiceIndex) => (
        <label key={`${item.id}-${choiceIndex}`} className="mt-2 block text-xs text-[var(--cc-text-muted)]">
          Choice {choiceIndex + 1}
          <input
            value={choice}
            onChange={(event) => {
              const choices = item.choices.slice()
              choices[choiceIndex] = event.target.value
              update({ choices })
            }}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--cc-text)]"
          />
        </label>
      ))}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[var(--cc-text-muted)]">
          Answer
          <input
            value={item.answer}
            onChange={(event) => update({ answer: event.target.value })}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--cc-text)]"
          />
        </label>
        <label className="text-xs text-[var(--cc-text-muted)]">
          Bloom
          <input
            value={item.bloom ?? ""}
            onChange={(event) => update({ bloom: event.target.value })}
            className="mt-1 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--cc-text)]"
          />
        </label>
      </div>
      {item.flags?.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {item.flags.map((flag) => (
            <li key={`${flag.kind}-${flag.message}`} className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-200">
              {flag.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
          Previous
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={index >= items.length - 1} onClick={() => setIndex((value) => value + 1)}>
          Next
        </Button>
        {portal === "faculty" ? (
          <Button type="button" size="sm" className="rounded-full" disabled={busy} onClick={() => void accept()}>
            {busy ? "Preparing…" : "Accept this item"}
          </Button>
        ) : null}
      </div>
      {note ? <p className="mt-2 text-xs text-destructive">{note}</p> : null}
      {proposal ? <CoraActionCard proposal={proposal} portal="faculty" /> : null}
    </Shell>
  )
}

function LecturePackCard({ data, portal }: { data: CoraLecturePackData; portal: Portal }) {
  const [note, setNote] = useState("")
  return (
    <Shell>
      <p className="text-sm font-semibold text-[var(--cc-text)]">{data.title}</p>
      {data.deck.length ? (
        <ul className="mt-3 space-y-2">
          {data.deck.map((card) => (
            <li key={card.front} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
              <CoraMathText text={card.front} compact className="text-sm font-medium text-[var(--cc-text)]" />
              <CoraMathText text={card.back} compact className="text-sm text-[var(--cc-text-muted)]" />
            </li>
          ))}
        </ul>
      ) : null}
      {data.glossary.length ? (
        <dl className="mt-3 space-y-2">
          {data.glossary.map((entry) => (
            <div key={entry.term}>
              <dt className="text-sm font-medium text-[var(--cc-text)]">
                <CoraMathText text={entry.term} compact />
              </dt>
              <dd className="text-sm text-[var(--cc-text-muted)]">
                <CoraMathText text={entry.definition} compact />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {portal === "student"
        ? (data.practice ?? [])
            .filter((item) => item.choices.length > 0)
            .map((item) => (
              <ChoiceRadios
                key={item.id}
                name={`lecture-${item.id}`}
                prompt={item.stem}
                choices={item.choices}
                answer={item.answer}
              />
            ))
        : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 rounded-full"
        onClick={() => {
          void saveDraft(portal, portal === "faculty" ? "lecture_pack" : "deck", data.title, {
            ...data,
            cards: data.deck,
          })
            .then(() => setNote("Kept on your shelf."))
            .catch((error: unknown) => setNote(error instanceof Error ? error.message : "Could not keep this."))
        }}
      >
        Keep on shelf
      </Button>
      {note ? <p className="mt-2 text-xs text-[var(--cc-text-muted)]">{note}</p> : null}
    </Shell>
  )
}

export function CoraUiPayloadCard({ ui, portal = "student", className, onApplyCode, applyDiff }: Props) {
  const [reasoningOpen, setReasoningOpen] = useState(false)
  const [patchNote, setPatchNote] = useState("")
  const progressLinks = useMemo(() => {
    if (ui.type !== "progress_summary") return []
    return (ui.data.actions ?? []).map((action) => ({
      ...action,
      href: PROGRESS_ROUTES[action.route] ?? action.route,
    }))
  }, [ui])

  if (ui.type === "confirmation" || ui.type === "text_response") return null
  if (ui.type === "error" || ui.type === "permission_denied" || ui.type === "insufficient_credits") {
    return (
      <Shell className={className}>
        <p className="text-sm text-[var(--cc-text)]">{ui.message}</p>
      </Shell>
    )
  }
  if (ui.type === "created_resource") {
    const href = ui.actions?.find((action) => action.route)?.route
    return (
      <Shell className={className}>
        <p className="text-sm font-medium text-[var(--cc-text)]">{ui.resource.title || ui.message}</p>
        {href ? (
          <Link href={href} className="mt-2 inline-flex text-xs font-medium underline-offset-2 hover:underline">
            Open
          </Link>
        ) : null}
      </Shell>
    )
  }
  if (ui.type === "walkthrough") return <div className={className}><WalkthroughCard ui={ui} /></div>
  if (ui.type === "question_preview") return <div className={className}><QuestionCard ui={ui} portal={portal} /></div>
  if (ui.type === "lecture_pack") return <div className={className}><LecturePackCard data={ui.data} portal={portal} /></div>
  if (ui.type === "assessment_preview") {
    return (
      <Shell className={className}>
        <p className="text-sm font-semibold text-[var(--cc-text)]">{ui.data.title}</p>
        <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{ui.message}</p>
        <p className="mt-2 text-xs text-[var(--cc-text-muted)]">{ui.data.itemCount} items</p>
        {ui.data.topics.length ? (
          <p className="mt-1 text-xs text-[var(--cc-text)]">{ui.data.topics.join(" · ")}</p>
        ) : null}
      </Shell>
    )
  }
  if (ui.type === "analytics") {
    return (
      <Shell className={className}>
        <p className="text-sm font-semibold text-[var(--cc-text)]">{ui.data.finding}</p>
        <div className="mt-3 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ui.data.series}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={28} />
              <Bar dataKey="value" fill="var(--cc-accent, #582c83)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {ui.data.misconceptions?.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-[var(--cc-text)]">
            {ui.data.misconceptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {ui.data.reasoning ? (
          <button type="button" className="mt-3 text-xs font-medium text-[var(--cc-text-muted)]" onClick={() => setReasoningOpen((open) => !open)}>
            {reasoningOpen ? "Hide reasoning" : "Reasoning"}
          </button>
        ) : null}
        {reasoningOpen && ui.data.reasoning ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-muted)]">{ui.data.reasoning}</p>
        ) : null}
      </Shell>
    )
  }
  if (ui.type === "progress_summary") {
    return (
      <Shell className={className}>
        <p className="text-sm text-[var(--cc-text)]">{ui.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ui.data.chips.map((chip) => (
            <span key={chip.label} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--cc-text)]">
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {progressLinks.map((action) => (
            <Link key={action.label} href={action.href} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--cc-text)]">
              {action.label}
            </Link>
          ))}
        </div>
      </Shell>
    )
  }
  if (ui.type === "code_patch") {
    const blocked = (ui.data.issues ?? []).some((issue) => /answer|assertion/i.test(issue))
    return (
      <Shell className={className}>
        <p className="text-sm font-medium text-[var(--cc-text)]">{ui.message}</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-[var(--muted)]/40 px-3 py-2 text-xs">{ui.data.diff}</pre>
        {ui.data.issues?.length ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
            {ui.data.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
        {onApplyCode && applyDiff ? (
          <Button
            type="button"
            size="sm"
            className="mt-3 rounded-full"
            disabled={blocked}
            onClick={() => {
              const next = applyDiff(ui.data.diff)
              if (!next) {
                setPatchNote("Could not apply this diff to the open buffer.")
                return
              }
              onApplyCode(next)
              setPatchNote("Applied to the open buffer.")
            }}
          >
            Apply
          </Button>
        ) : null}
        {patchNote ? <p className="mt-2 text-xs text-[var(--cc-text-muted)]">{patchNote}</p> : null}
      </Shell>
    )
  }
  return null
}
