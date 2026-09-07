"use client"

import type { ReactNode } from "react"
import type { Element } from "hast"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { motion } from "framer-motion"
import {
  Award,
  BookOpen,
  Target,
  Zap,
  ClipboardList,
  Lightbulb,
  Wrench,
  Users,
  MessageCircle,
  ImageIcon,
  LifeBuoy,
  HeartHandshake,
  Layers,
  Eye,
  Cpu,
  ListChecks,
  PartyPopper,
  type LucideIcon,
} from "lucide-react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { polishXrMarkdown } from "@/lib/summer-camp/curriculum/xr-markdown-polish"
import { CampZoomableImage } from "@/components/summer-camp/CampZoomableImage"
import { cn } from "@/lib/utils"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"
import { CAMP_PRESENTATION_DARK_RESET } from "@/lib/summer-camp/camp-presentation-styles"

function stripLeadingSectionHeading(markdown: string): string {
  return markdown.replace(/^## .+\n+/, "").replace(/^### .+\n+/, "").trim()
}

type SectionVariant =
  | "objectives"
  | "challenge"
  | "deliverable"
  | "build"
  | "community"
  | "concepts"
  | "overview"
  | "comparison"
  | "completion"
  | "default"

type ParsedSection = {
  title: string | null
  body: string
  variant: SectionVariant
}

const VARIANT_STYLES: Record<
  SectionVariant,
  { icon: LucideIcon; border: string; bg: string; title: string; iconColor: string }
> = {
  objectives: {
    icon: Target,
    border: "border-emerald-500/30",
    bg: "from-emerald-500/[0.08] to-transparent",
    title: "text-emerald-800 dark:text-emerald-300",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  challenge: {
    icon: Zap,
    border: "border-amber-500/35",
    bg: "from-amber-500/[0.1] to-transparent",
    title: "text-amber-900 dark:text-amber-200",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  deliverable: {
    icon: ClipboardList,
    border: "border-sky-500/30",
    bg: "from-sky-500/[0.08] to-transparent",
    title: "text-sky-900 dark:text-sky-200",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  build: {
    icon: Wrench,
    border: "border-violet-500/30",
    bg: "from-violet-500/[0.08] to-transparent",
    title: "text-violet-900 dark:text-violet-200",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  community: {
    icon: Users,
    border: "border-indigo-500/30",
    bg: "from-indigo-500/[0.08] to-transparent",
    title: "text-indigo-900 dark:text-indigo-200",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
  concepts: {
    icon: Eye,
    border: "border-cyan-500/30",
    bg: "from-cyan-500/[0.08] to-transparent",
    title: "text-cyan-900 dark:text-cyan-200",
    iconColor: "text-cyan-600 dark:text-cyan-400",
  },
  overview: {
    icon: Layers,
    border: "border-violet-500/25",
    bg: "from-violet-500/[0.06] to-transparent",
    title: "text-violet-900 dark:text-violet-100",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  comparison: {
    icon: ListChecks,
    border: "border-slate-300/60 dark:border-white/15",
    bg: "from-slate-500/[0.05] to-transparent",
    title: "text-slate-900 dark:text-white",
    iconColor: "text-slate-600 dark:text-slate-300",
  },
  completion: {
    icon: PartyPopper,
    border: "border-emerald-500/35",
    bg: "from-emerald-500/[0.12] via-violet-500/[0.06] to-transparent",
    title: "text-emerald-900 dark:text-emerald-100",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  default: {
    icon: BookOpen,
    border: "border-slate-200/80 dark:border-white/10",
    bg: "from-slate-500/[0.04] to-transparent",
    title: "text-slate-900 dark:text-white",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
}

function detectVariant(title: string | null): SectionVariant {
  if (!title) return "default"
  const t = title.toLowerCase()
  if (t.includes("learning objectives") || t.includes("module goal")) return "objectives"
  if (t.includes("program overview") || t.includes("module overview") || t.includes("software stack") || t.includes("recommended software"))
    return "overview"
  if (t.includes("opening challenge") || t.startsWith("challenge") || t.includes("opening story"))
    return "challenge"
  if (t.includes("deliverable")) return "deliverable"
  if (
    t.includes("key concept") ||
    t.includes("explanation card") ||
    t.includes("what eye tracking measures")
  )
    return "concepts"
  if (
    t.includes("device comparison") ||
    t.includes("comparison") ||
    t.includes("team roles") ||
    t.includes("data streams") ||
    t.includes("safety rules") ||
    t.includes("do not")
  )
    return "comparison"
  if (
    t.includes("what will we build") ||
    t.includes("what is ") ||
    t.includes("what are ") ||
    t.includes("meet the devices")
  )
    return "build"
  if (t.includes("camp community") || t.includes("camp expectations")) return "community"
  if (
    t.includes("program completion") ||
    t.includes("congratulations") ||
    t.includes("you did it")
  )
    return "completion"
  if (
    t.includes("certification requirements") ||
    t.includes("certificate requirements") ||
    t.includes("final certification")
  )
    return "deliverable"
  if (t.includes("you are now prepared") || t.includes("research skills")) return "objectives"
  if (t.startsWith("section ")) return "default"
  return "default"
}

function parseSections(markdown: string): ParsedSection[] {
  const normalized = markdown.replace(/\n{3,}/g, "\n\n").trim()
  if (!normalized) return []

  if (normalized.startsWith("## ")) {
    const parts = normalized.split(/\n(?=## )/)
    return parts.map((part) => {
      const lines = part.split("\n")
      const title = lines[0]?.startsWith("## ") ? lines[0].slice(3).trim() : null
      const body = title ? lines.slice(1).join("\n").trim() : part.trim()
      return { title, body, variant: detectVariant(title) }
    })
  }

  if (normalized.startsWith("### ")) {
    const parts = normalized.split(/\n(?=### )/)
    return parts.map((part) => {
      const lines = part.split("\n")
      const title = lines[0]?.startsWith("### ") ? lines[0].slice(4).trim() : null
      const body = title ? lines.slice(1).join("\n").trim() : part.trim()
      return { title, body, variant: detectVariant(title) }
    })
  }

  return [{ title: null, body: normalized, variant: "default" }]
}

function isDefinitionParagraph(children: ReactNode): boolean {
  const text = String(children ?? "").trim()
  return /^\*\*[^*]+\*\*\s*[—–-]\s*.+/.test(text)
}

function DefinitionCard({ children }: { children?: ReactNode }) {
  const text = String(children ?? "").trim()
  const match = text.match(/^\*\*([^*]+)\*\*\s*[—–-]\s*(.+)$/s)
  if (!match) {
    return (
      <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed mb-3 last:mb-0">
        {children}
      </p>
    )
  }
  return (
    <div className="mb-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] px-3.5 py-3">
      <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">{match[1]}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{match[2]}</p>
    </div>
  )
}

function communityHelpIcon(children: ReactNode): LucideIcon {
  const text = String(children ?? "").toLowerCase()
  if (text.includes("ask") || text.includes("question")) return MessageCircle
  if (text.includes("upload") || text.includes("screenshot")) return ImageIcon
  if (text.includes("contact") || text.includes("support") || text.includes("instructor")) return LifeBuoy
  return HeartHandshake
}

function CommunityHelpItem({ children }: { children?: ReactNode }) {
  const Icon = communityHelpIcon(children)
  return (
    <li className="list-none">
      <div className="flex gap-3 rounded-xl border border-indigo-500/20 bg-white/70 dark:bg-white/[0.04] p-3.5 h-full">
        <div className="size-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed min-w-0 [&_strong]:block [&_strong]:font-semibold [&_strong]:text-slate-900 [&_strong]:dark:text-white [&_strong]:mb-0.5">
          {children}
        </div>
      </div>
    </li>
  )
}

function ConceptListItem({ children }: { children?: ReactNode }) {
  return (
    <li className="list-none">
      <div className="flex items-start gap-2.5 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] px-3 py-2.5">
        <Cpu className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">{children}</span>
      </div>
    </li>
  )
}

function paragraphContainsImage(node?: Element): boolean {
  return Boolean(
    node?.children?.some((child) => child.type === "element" && child.tagName === "img"),
  )
}

function markdownComponents(variant: SectionVariant) {
  const isObjectives = variant === "objectives"
  const isCommunity = variant === "community"
  const isConcepts = variant === "concepts"
  const isCompletion = variant === "completion"
  const useGridBullets = variant === "overview" || variant === "build" || variant === "challenge"

  return {
    p({ node, children }: { node?: Element; children?: ReactNode }) {
      if (isDefinitionParagraph(children)) {
        return <DefinitionCard>{children}</DefinitionCard>
      }
      const className =
        "text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed mb-3 last:mb-0"
      if (paragraphContainsImage(node)) {
        return <div className={className}>{children}</div>
      }
      return <p className={className}>{children}</p>
    },
    h3({ children }: { children?: ReactNode }) {
      return (
        <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-2.5 first:mt-0 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-violet-500 shrink-0" />
          {children}
        </h3>
      )
    },
    h4({ children }: { children?: ReactNode }) {
      return (
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-3 mb-1.5">
          {children}
        </h4>
      )
    },
    ul({ children }: { children?: ReactNode }) {
      if (isCommunity) {
        return <ul className="grid gap-3 sm:grid-cols-2 mb-1 list-none pl-0">{children}</ul>
      }
      if (isConcepts) {
        return <ul className="grid gap-2 sm:grid-cols-2 mb-3 list-none pl-0">{children}</ul>
      }
      if (useGridBullets) {
        return <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-3 list-none pl-0">{children}</ul>
      }
      return (
        <ul
          className={cn(
            "mb-3 space-y-2.5",
            isObjectives ? "list-none pl-0" : "list-disc pl-5 marker:text-violet-400",
          )}
        >
          {children}
        </ul>
      )
    },
    ol({ children }: { children?: ReactNode }) {
      return (
        <ol className="mb-3 space-y-2.5 list-decimal pl-6 marker:font-bold marker:text-violet-600 text-sm sm:text-[15px]">
          {children}
        </ol>
      )
    },
    li({ children }: { children?: ReactNode }) {
      if (isCommunity) {
        return <CommunityHelpItem>{children}</CommunityHelpItem>
      }
      if (isConcepts) {
        return <ConceptListItem>{children}</ConceptListItem>
      }
      if (isObjectives) {
        return (
          <li className="flex items-start gap-2.5 text-sm sm:text-[15px] text-slate-600 dark:text-slate-300">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
              ✓
            </span>
            <span className="flex-1 pt-0.5 leading-relaxed">{children}</span>
          </li>
        )
      }
      if (useGridBullets) {
        return (
          <li className="list-none">
            <div className="h-full rounded-lg border border-violet-500/15 bg-white/50 dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {children}
            </div>
          </li>
        )
      }
      return (
        <li className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed pl-1 marker:font-medium">
          {children}
        </li>
      )
    },
    strong({ children }: { children?: ReactNode }) {
      return <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
    },
    em({ children }: { children?: ReactNode }) {
      return <em className="italic text-slate-700 dark:text-slate-200">{children}</em>
    },
    blockquote({ children }: { children?: ReactNode }) {
      return (
        <blockquote
          className={cn(
            "border-l-4 pl-4 my-3 text-sm sm:text-[15px] py-3 pr-3 rounded-r-lg not-italic leading-relaxed",
            isCompletion
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 font-medium"
              : "border-violet-500/50 text-slate-700 dark:text-slate-200 bg-violet-500/5",
          )}
        >
          {children}
        </blockquote>
      )
    },
    img({ src, alt }: { src?: string; alt?: string }) {
      if (!src) return null
      const isDocScreenshot =
        src.includes("/unity-docs/") || src.includes("/vive-docs/") || src.includes("/engine-docs/")
      return (
        <CampZoomableImage
          src={src}
          alt={alt ?? ""}
          className={cn(
            "my-4 w-full overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm",
          )}
          imgClassName={cn(
            "w-full",
            isDocScreenshot ? "object-contain max-h-[520px] p-2" : "object-cover",
          )}
        />
      )
    },
    code({ children }: { children?: ReactNode }) {
      return (
        <code className="rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-xs font-mono text-violet-700 dark:text-violet-300">
          {children}
        </code>
      )
    },
    table({ children }: { children?: ReactNode }) {
      return (
        <div className="my-4 overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10 shadow-sm">
          <table className="w-full min-w-[280px] border-collapse text-left text-sm">{children}</table>
        </div>
      )
    },
    thead({ children }: { children?: ReactNode }) {
      return (
        <thead className="bg-slate-100 text-slate-800 border-b border-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:border-white/10">
          {children}
        </thead>
      )
    },
    tbody({ children }: { children?: ReactNode }) {
      return <tbody className="divide-y divide-slate-200/80 dark:divide-white/10 bg-white/70 dark:bg-white/[0.02]">{children}</tbody>
    },
    tr({ children }: { children?: ReactNode }) {
      return <tr className="even:bg-slate-50/80 dark:even:bg-white/[0.02]">{children}</tr>
    },
    th({ children }: { children?: ReactNode }) {
      return (
        <th className="px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold uppercase tracking-wide whitespace-nowrap">
          {children}
        </th>
      )
    },
    td({ children }: { children?: ReactNode }) {
      return (
        <td className="px-3 py-2.5 sm:px-4 sm:py-3 text-slate-700 dark:text-slate-200 align-top leading-snug">
          {children}
        </td>
      )
    },
  }
}

function SectionBody({ section }: { section: ParsedSection }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents(section.variant)}>
      {section.body}
    </ReactMarkdown>
  )
}

function SectionCard({
  section,
  index,
  collapsible = true,
  defaultOpen = false,
}: {
  section: ParsedSection
  index: number
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const inPresentation = useCampPresentation()
  const style = VARIANT_STYLES[section.variant]
  const Icon = style.icon
  const cardClass = cn(
    "rounded-xl border bg-gradient-to-br overflow-hidden",
    style.border,
    style.bg,
    inPresentation && cn("!bg-white !from-white !to-white !bg-none border-white/20 shadow-lg", CAMP_PRESENTATION_DARK_RESET),
  )

  if (!section.title) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.35 }}
        className={cardClass}
      >
        <div className="px-4 sm:px-5 py-4 sm:py-5">
          <SectionBody section={section} />
        </div>
      </motion.div>
    )
  }

  if (!collapsible) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.35 }}
        className={cardClass}
      >
        <div className="flex items-start gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <div className="size-10 rounded-lg bg-white/70 dark:bg-white/10 flex items-center justify-center shrink-0 shadow-sm">
            <Icon className={cn("h-4 w-4", style.iconColor)} />
          </div>
          <h2 className={cn("text-base sm:text-lg font-bold leading-snug pt-1.5", style.title)}>
            {section.title}
          </h2>
        </div>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          <SectionBody section={section} />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      <Collapsible
        defaultOpen={defaultOpen}
        className={cardClass}
      >
        <CollapsibleTrigger className="flex w-full items-start gap-3 px-4 sm:px-5 py-4 text-left hover:bg-white/30 dark:hover:bg-white/[0.03] transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
          <div className="size-10 rounded-lg bg-white/70 dark:bg-white/10 flex items-center justify-center shrink-0 shadow-sm">
            <Icon className={cn("h-4 w-4", style.iconColor)} />
          </div>
          <span className="flex-1 min-w-0">
            <span className={cn("block text-base sm:text-lg font-bold leading-snug", style.title)}>
              {section.title}
            </span>
          </span>
          <ChevronDown className="chevron h-5 w-5 shrink-0 text-slate-400 mt-2 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-white/40 dark:border-white/10">
            <SectionBody section={section} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  )
}

export function CampRichMarkdown({
  markdown,
  omitLeadingSectionHeading = false,
  collapsibleSections = true,
  defaultOpenSectionIndex = 0,
}: {
  markdown: string
  omitLeadingSectionHeading?: boolean
  collapsibleSections?: boolean
  defaultOpenSectionIndex?: number
}) {
  const polished = polishXrMarkdown(markdown)
  const source = omitLeadingSectionHeading ? stripLeadingSectionHeading(polished) : polished
  const sections = parseSections(source)
  const inPresentation = useCampPresentation()

  if (sections.length === 0) return null

  if (sections.length === 1 && !sections[0].title) {
    const section = sections[0]
    return (
      <div
        className={cn(
          "rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-4 sm:p-5",
          inPresentation && cn("!bg-white !from-white !to-white !bg-none border-white/20 shadow-lg", CAMP_PRESENTATION_DARK_RESET),
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents("default")}>
          {section.body}
        </ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <SectionCard
          key={`${section.title ?? "section"}-${i}`}
          section={section}
          index={i}
          collapsible={collapsibleSections}
          defaultOpen={i === defaultOpenSectionIndex}
        />
      ))}
    </div>
  )
}
