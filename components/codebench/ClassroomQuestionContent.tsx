"use client"

import { BookOpen } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { structureClassroomPrompt } from "@/lib/classroom-question-layout"
import { syntaxCardsForClassroomPrompt } from "@/lib/classroom-syntax-reference"

function promptSentences(paragraphs: string[]): string[] {
  return paragraphs.flatMap((paragraph) =>
    paragraph
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean),
  )
}

function RuleRow({
  item,
  index,
}: {
  item: { text: string; label?: string; children?: { text: string; label?: string }[] }
  index: number
}) {
  const invalid = /invalid/i.test(`${item.label ?? ""} ${item.text}`)
  return (
    <li className={`px-3 py-2.5 ${invalid ? "bg-amber-500/[0.06]" : ""}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_12%,transparent)] text-[10px] font-semibold text-[var(--cc-text)]">
          {index + 1}
        </span>
        {item.label ? (
          <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
            <span className="text-sm text-[var(--cc-text)]">{item.label}</span>
            <span className="shrink-0 font-mono text-sm font-semibold text-[var(--cc-text)]">{item.text}</span>
          </div>
        ) : (
          <span className="text-sm leading-relaxed text-[var(--cc-text)]">{item.text}</span>
        )}
      </div>
      {item.children && item.children.length > 0 ? (
        <ul className="mt-2 space-y-1.5 pl-7">
          {item.children.map((child) => (
            <li
              key={`${child.label ?? ""}-${child.text}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5"
            >
              {child.label ? (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-[var(--cc-text)]">{child.label}</span>
                  <span className="text-right text-xs text-[var(--cc-text-secondary,var(--cc-text-muted))]">{child.text}</span>
                </div>
              ) : (
                <span className="text-xs leading-relaxed text-[var(--cc-text)]">{child.text}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function ClassroomQuestionContent({
  title,
  questionText,
  showSyntaxReference = false,
}: {
  title: string
  questionText: string
  showSyntaxReference?: boolean
}) {
  const blocks = structureClassroomPrompt(questionText)
  const cards = showSyntaxReference ? syntaxCardsForClassroomPrompt(title, questionText) : []

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "chips") {
          return (
            <section key={`${block.title}-${index}`} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                {block.title}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--cc-text)]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )
        }
        if (block.type === "callout") {
          return (
            <section
              key={`${block.title}-${index}`}
              className="rounded-xl border border-[var(--cc-accent)]/30 bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--card))] px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                {block.title}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-tight text-[var(--cc-text)]">{block.body}</p>
            </section>
          )
        }
        if (block.type === "prose") {
          const sentences = promptSentences(block.paragraphs)
          return (
            <section
              key={`prose-${index}`}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-sm"
            >
              <p className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                Prompt
              </p>
              <ol className="divide-y divide-[var(--border)]">
                {sentences.map((sentence, sentenceIndex) => (
                  <li key={`${sentenceIndex}-${sentence.slice(0, 24)}`} className="flex gap-2.5 px-3 py-2.5">
                    <span className="mt-0.5 text-[11px] font-semibold text-[var(--cc-accent)]">{sentenceIndex + 1}</span>
                    <span className="text-sm leading-relaxed text-[var(--cc-text)]">{sentence}</span>
                  </li>
                ))}
              </ol>
            </section>
          )
        }
        if (block.type === "list") {
          return (
            <section
              key={`${block.title}-${index}`}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-sm"
            >
              <p className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                {block.title}
              </p>
              <ul className="divide-y divide-[var(--border)]">
                {block.items.map((item, itemIndex) => (
                  <RuleRow key={`${item.label ?? item.text}-${itemIndex}`} item={item} index={itemIndex} />
                ))}
              </ul>
            </section>
          )
        }
        if (block.type === "inputs") {
          return (
            <section
              key={`${block.title}-${index}`}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-sm"
            >
              <p className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                {block.title}
              </p>
              <ul className="divide-y divide-[var(--border)]">
                {block.items.map((item) => (
                  <li key={item.name} className="px-3 py-2">
                    <p className="text-sm font-medium text-[var(--cc-text)]">{item.name}</p>
                    {item.detail ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                        {item.detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )
        }
        if (block.type === "example") {
          return (
            <section key={`example-${index}`} className="grid gap-2">
              {block.input ? (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    Sample input
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-sm text-[var(--cc-text)]">{block.input}</pre>
                </div>
              ) : null}
              {block.output ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Expected output
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-sm text-[var(--cc-text)]">{block.output}</pre>
                </div>
              ) : null}
              {block.variants?.map((variant) => (
                <div
                  key={variant.output}
                  className="rounded-xl border border-emerald-500/20 bg-[var(--background)] px-3 py-2.5"
                >
                  {variant.caption ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                      {variant.caption}
                    </p>
                  ) : null}
                  <pre className="mt-1 whitespace-pre-wrap font-mono text-sm text-[var(--cc-text)]">{variant.output}</pre>
                </div>
              ))}
            </section>
          )
        }
        if (block.type === "note") {
          return (
            <div
              key={`note-${index}`}
              className="rounded-lg border-l-2 border-[var(--cc-accent)] bg-[color-mix(in_srgb,var(--cc-accent)_6%,transparent)] px-3 py-2 text-sm leading-relaxed text-[var(--cc-text)]"
            >
              {block.body}
            </div>
          )
        }
        return null
      })}

      {cards.length > 0 ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2.5">
            <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
            <div>
              <p className="text-xs font-semibold text-[var(--cc-text)]">Syntax reference</p>
              <p className="text-[11px] leading-snug text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                Blank patterns for this question. They are not the answer.
              </p>
            </div>
          </div>
          <Accordion type="multiple" className="px-3">
            {cards.map((card) => (
              <AccordionItem key={card.id} value={card.id}>
                <AccordionTrigger className="py-2.5 text-sm hover:no-underline">
                  {card.title}
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <p className="mb-2 text-xs leading-relaxed text-[var(--cc-text-secondary,var(--cc-text-muted))]">
                    {card.note}
                  </p>
                  <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-text)_4%,var(--card))] p-3 font-mono text-[12px] leading-relaxed text-[var(--cc-text)]">
                    {card.code}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}
    </div>
  )
}
