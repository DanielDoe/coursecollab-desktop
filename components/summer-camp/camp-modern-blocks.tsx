"use client"

import { useState } from "react"
import {
  AlarmClock,
  ArrowDown,
  ArrowRight,
  BookOpen,
  Brain,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Cpu,
  Eye,
  GitBranch,
  PenLine,
  Lightbulb,
  MessageSquare,
  Music,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { cn } from "@/lib/utils"
import { CAMP_PRESENTATION_SURFACE } from "@/lib/summer-camp/camp-presentation-styles"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

const ICON_MAP: Record<string, LucideIcon> = {
  alarm: AlarmClock,
  message: MessageSquare,
  music: Music,
  map: Navigation,
  search: Search,
  brain: Brain,
  book: BookOpen,
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  cpu: Cpu,
  zap: Zap,
  wand: Wand2,
  calculator: Calculator,
  git: GitBranch,
}

function resolveIcon(name?: string): LucideIcon {
  if (!name) return Sparkles
  return ICON_MAP[name.toLowerCase()] ?? Sparkles
}

type StepDetailItem = { label: string; text: string }
type StepItem = {
  title: string
  body?: string
  icon?: string
  details?: Array<string | StepDetailItem>
}

function normalizeStepDetail(d: string | StepDetailItem): StepDetailItem {
  if (typeof d === "object") return d
  const split = d.indexOf(" — ")
  if (split > 0) return { label: d.slice(0, split), text: d.slice(split + 3) }
  return { label: "Includes", text: d }
}

function StepIncludesList({
  details,
  tone = "light",
}: {
  details: Array<string | StepDetailItem>
  tone?: "light" | "dark"
}) {
  const items = details.map(normalizeStepDetail)
  const isDark = tone === "dark"
  return (
    <div className="mt-3 space-y-2">
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-widest",
          isDark ? "text-slate-400" : "text-violet-600 dark:text-violet-400",
        )}
      >
        What&apos;s included
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={`${i}-${item.label}`}
            className={cn(
              "rounded-lg px-3 py-2.5 ring-1",
              isDark
                ? "bg-white/5 ring-white/10"
                : "bg-white/70 dark:bg-white/[0.04] ring-slate-200/70 dark:ring-white/10",
            )}
          >
            <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900 dark:text-white")}>
              {item.label}
            </p>
            <p className={cn("mt-0.5 text-xs sm:text-sm leading-relaxed", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-400")}>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepDetailPanel({
  step,
  stepIndex,
  totalSteps,
  className,
}: {
  step?: StepItem
  stepIndex: number
  totalSteps: number
  className?: string
}) {
  const inPresentation = useCampPresentation()
  if (!step) return null
  const Icon = resolveIcon(step.icon)
  return (
    <div className={cn("rounded-xl p-4 sm:p-5 bg-violet-500/8 ring-1 ring-violet-500/15", className)}>
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="size-11 shrink-0 rounded-xl bg-violet-500/15 flex items-center justify-center ring-1 ring-violet-500/20">
          <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p
              className={cn(
                "font-bold",
                inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
              )}
            >
              {step.title}
            </p>
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                inPresentation ? "text-violet-700" : "text-violet-600 dark:text-violet-400",
              )}
            >
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          {step.body ? (
            <p
              className={cn(
                "text-sm leading-relaxed",
                inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-300",
              )}
            >
              {step.body}
            </p>
          ) : null}
          {step.details && step.details.length > 0 ? (
            <StepIncludesList details={step.details} tone="light" />
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Animated flow diagram — fills the right column when no image is provided */
function FlowVisualPanel({
  steps,
  active,
  title,
  onStepSelect,
}: {
  steps: StepItem[]
  active: number
  title?: string
  onStepSelect?: (index: number) => void
}) {
  const inPresentation = useCampPresentation()
  const step = steps[active]
  const Icon = resolveIcon(step?.icon)
  const progress = steps.length > 1 ? (active / (steps.length - 1)) * 100 : 100

  return (
    <div
      className={cn(
        "camp-flow-panel relative flex flex-col h-full rounded-2xl p-5 sm:p-6 ring-1",
        inPresentation
          ? "min-h-[280px] lg:min-h-0 bg-gradient-to-br from-violet-50 via-white to-sky-50 text-slate-900 ring-violet-200/70 overflow-hidden"
          : "min-h-[360px] lg:min-h-[420px] overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-violet-950 text-white ring-slate-700/40",
      )}
    >
      {!inPresentation ? (
        <div
          className="absolute inset-0 opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 15%, rgba(139,92,246,0.2) 0%, transparent 50%), radial-gradient(circle at 85% 85%, rgba(99,102,241,0.15) 0%, transparent 45%)",
          }}
        />
      ) : null}
      <div className="relative z-10 flex flex-col h-full min-h-0">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest mb-1",
            inPresentation ? "text-violet-800" : "text-slate-400",
          )}
        >
          {title ?? "Your path"}
        </p>
        <div className="flex items-center gap-2 mb-4">
          <div
            className={cn(
              "h-1.5 flex-1 rounded-full overflow-hidden",
              inPresentation ? "bg-violet-100" : "bg-white/10",
            )}
          >
            <motion.div
              className={cn("h-full rounded-full", inPresentation ? "bg-violet-600" : "bg-violet-400/70")}
              animate={{ width: `${Math.max(progress, 8)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              inPresentation ? "text-slate-700" : "text-slate-300",
            )}
          >
            {active + 1}/{steps.length}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col min-h-0"
          >
            <div
              className={cn(
                "size-12 rounded-xl flex items-center justify-center mb-3 ring-1",
                inPresentation
                  ? "bg-violet-100 text-violet-700 ring-violet-200/80"
                  : "bg-white/10 backdrop-blur-sm text-violet-200 ring-white/15",
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <p
              className={cn(
                "text-lg sm:text-xl font-bold leading-tight",
                inPresentation ? "text-slate-900" : "text-white",
              )}
            >
              {step?.title}
            </p>
            {step?.body ? (
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed",
                  inPresentation ? "text-slate-700" : "text-slate-300",
                )}
              >
                {step.body}
              </p>
            ) : null}
            {step?.details && step.details.length > 0 ? (
              <StepIncludesList details={step.details} tone={inPresentation ? "light" : "dark"} />
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto pt-4 flex flex-wrap items-center justify-center gap-1.5">
          {steps.map((s, i) => {
            const StepIcon = resolveIcon(s.icon)
            const isActive = i === active
            const isPast = i < active
            return (
              <button
                key={`${i}-${s.title}`}
                type="button"
                onClick={() => onStepSelect?.(i)}
                title={s.title}
                className={cn(
                  "size-8 rounded-full flex items-center justify-center transition-all",
                  inPresentation
                    ? isActive && "bg-violet-600 text-white shadow-md ring-2 ring-violet-300/40 scale-110"
                    : isActive && "bg-violet-500 text-white shadow-md ring-2 ring-violet-300/40 scale-110",
                  inPresentation
                    ? !isActive && isPast && "bg-violet-200 text-violet-800"
                    : !isActive && isPast && "bg-white/20 text-violet-200",
                  inPresentation
                    ? !isActive && !isPast && "bg-violet-50 text-violet-400 hover:bg-violet-100 hover:text-violet-700 ring-1 ring-violet-200/60"
                    : !isActive && !isPast && "bg-white/10 text-slate-500 hover:bg-white/15 hover:text-slate-300",
                )}
              >
                <StepIcon className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Full-width option grid for poll / pledge activities */
export function CampPollOptionGrid({
  options,
  selected,
  multiSelect,
  disabled,
  onToggle,
}: {
  options: string[]
  selected: number[]
  multiSelect?: boolean
  disabled?: boolean
  onToggle: (index: number) => void
}) {
  const inPresentation = useCampPresentation()
  const cols =
    options.length <= 4 ? "sm:grid-cols-2" : options.length <= 6 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"

  return (
    <div className={cn("grid gap-2.5 sm:gap-3", cols)}>
      {options.map((opt, idx) => {
        const isSelected = selected.includes(idx)
        return (
          <motion.button
            key={opt}
            type="button"
            disabled={disabled}
            whileHover={disabled ? undefined : { scale: 1.01 }}
            whileTap={disabled ? undefined : { scale: 0.99 }}
            onClick={() => onToggle(idx)}
            className={cn(
              "relative text-left rounded-xl px-3 py-3 sm:px-4 sm:py-3.5 transition-all duration-200 min-h-[3.25rem] flex items-center gap-3",
              isSelected
                ? "bg-violet-500/15 ring-2 ring-violet-500/50 shadow-md shadow-violet-500/10"
                : inPresentation
                  ? "bg-white ring-1 ring-slate-200/70 hover:ring-violet-400/40 hover:shadow-sm"
                  : "bg-white/80 dark:bg-white/[0.04] ring-1 ring-slate-200/70 dark:ring-white/10 hover:ring-violet-400/40 hover:shadow-sm",
            )}
          >
            <span
              className={cn(
                "size-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold transition-colors",
                isSelected
                  ? "bg-violet-600 text-white"
                  : inPresentation
                    ? "bg-slate-100 text-slate-600"
                    : "bg-slate-100 dark:bg-white/10 text-slate-500",
              )}
            >
              {isSelected ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(65 + idx)}
            </span>
            <span
              className={cn(
                "text-sm font-medium leading-snug min-w-0 break-words",
                isSelected
                  ? inPresentation
                    ? "text-violet-900"
                    : "text-violet-900 dark:text-violet-100"
                  : inPresentation
                    ? "text-slate-800"
                    : "text-slate-800 dark:text-slate-200",
              )}
            >
              {opt}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

/** Shared card shell — shadow + soft gradient, no thin accent stripe */
export function CampModernSurface({
  children,
  className,
  padding = "default",
}: {
  children: React.ReactNode
  className?: string
  padding?: "none" | "default" | "compact"
}) {
  const inPresentation = useCampPresentation()
  return (
    <div
      className={cn(
        "camp-modern-surface rounded-2xl",
        inPresentation
          ? cn(CAMP_PRESENTATION_SURFACE, "shadow-lg ring-1 ring-slate-200/80")
          : cn(
              "bg-gradient-to-br from-white via-slate-50/40 to-violet-50/30",
              "dark:from-slate-900/95 dark:via-slate-900 dark:to-violet-950/25",
              "shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)]",
              "dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.35)]",
              "ring-1 ring-slate-200/70 dark:ring-white/10",
            ),
        padding === "default" && "p-5 sm:p-6",
        padding === "compact" && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  )
}

function BlockHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const inPresentation = useCampPresentation()
  if (!title) return null
  return (
    <div className="mb-4 sm:mb-5">
      <h3
        className={cn(
          "text-lg sm:text-xl font-bold tracking-tight",
          inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
        )}
      >
        {title}
      </h3>
      {subtitle ? (
        <p
          className={cn(
            "mt-1.5 text-sm leading-relaxed",
            inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-400",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

type CardItem = { icon?: string; title: string; body?: string; description?: string; accent?: string }

function FeatureCard({
  card,
  index,
  focused,
  onFocus,
}: {
  card: CardItem
  index: number
  focused: boolean
  onFocus: () => void
}) {
  const inPresentation = useCampPresentation()
  const Icon = resolveIcon(card.icon)
  return (
    <motion.button
      type="button"
      onFocus={onFocus}
      onMouseEnter={onFocus}
      onClick={onFocus}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "group text-left w-full rounded-xl p-4 sm:p-5 transition-all duration-300",
        inPresentation ? "bg-white ring-1 ring-slate-200/80" : "bg-white/80 dark:bg-white/[0.04] backdrop-blur-sm ring-1 ring-slate-200/80 dark:ring-white/10",
        "hover:shadow-lg hover:shadow-violet-500/10 hover:-translate-y-0.5",
        focused && "ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/15 scale-[1.01]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "size-10 shrink-0 rounded-xl flex items-center justify-center",
            "bg-gradient-to-br from-violet-500/15 to-indigo-500/10",
            inPresentation ? "text-violet-700" : "text-violet-600 dark:text-violet-400",
            focused && "from-violet-500/25 to-indigo-500/20",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-sm sm:text-base",
              inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
            )}
          >
            {card.title}
          </p>
          <p
            className={cn(
              "mt-1.5 text-sm leading-relaxed",
              inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-300",
            )}
          >
            {card.body ?? card.description}
          </p>
        </div>
      </div>
    </motion.button>
  )
}

export function CampFeatureCardGridBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const cards = (content.cards as CardItem[]) ?? []
  const columns = Number(content.columns ?? 2)
  const [focused, setFocused] = useState(0)
  const title = content.title ? String(content.title) : undefined
  const subtitle = content.subtitle ? String(content.subtitle) : undefined

  return (
    <CampModernSurface>
      <BlockHeader title={title} subtitle={subtitle} />
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {cards.map((card, i) => (
          <FeatureCard
            key={card.title}
            card={card}
            index={i}
            focused={focused === i}
            onFocus={() => setFocused(i)}
          />
        ))}
      </div>
      {content.footer ? (
        <p
          className={cn(
            "mt-4 text-sm leading-relaxed",
            inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-400",
          )}
        >
          {String(content.footer)}
        </p>
      ) : null}
    </CampModernSurface>
  )
}

export function CampNumberedStepsBlock({ content }: { content: Record<string, unknown> }) {
  const steps = (content.steps as StepItem[]) ?? []
  const title = content.title ? String(content.title) : undefined
  const intro = content.intro ? String(content.intro) : undefined
  const footer = content.footer ? String(content.footer) : undefined
  const imageUrl = content.imageUrl ? String(content.imageUrl) : undefined
  const imageCaption = content.imageCaption ? String(content.imageCaption) : undefined
  const layout = String(content.layout ?? "split")
  const splitWithImage = layout === "split" && Boolean(imageUrl)
  const inPresentation = useCampPresentation()
  const [active, setActive] = useState(0)
  const activeStep = steps[active]

  const stepList = (
    <div
      className={cn(
        "space-y-2 pr-1",
        splitWithImage || inPresentation
          ? "max-h-none overflow-visible"
          : "max-h-[min(420px,52vh)] overflow-y-auto",
        layout === "compact" && "sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0 sm:max-h-none sm:overflow-visible sm:pr-0",
      )}
    >
      {steps.map((step, i) => {
        const Icon = resolveIcon(step.icon)
        const isActive = active === i
        return (
          <motion.button
            key={`${i}-${step.title}`}
            type="button"
            onClick={() => setActive(i)}
            whileHover={{ scale: 1.01 }}
            className={cn(
              "w-full text-left flex gap-3 rounded-xl p-3 transition-all duration-200",
              isActive
                ? "bg-violet-500/10 ring-2 ring-violet-500/40 shadow-md"
                : inPresentation
                  ? "bg-slate-50/80 ring-1 ring-slate-200/70 hover:ring-violet-400/40"
                  : "bg-slate-50/80 dark:bg-white/[0.03] ring-1 ring-slate-200/70 dark:ring-white/10 hover:ring-violet-400/40",
            )}
          >
            <span
              className={cn(
                "size-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold",
                isActive
                  ? "bg-violet-600 text-white"
                  : "bg-violet-500/15 text-violet-700 dark:text-violet-300",
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-violet-500 shrink-0" />
                <p
                  className={cn(
                    "font-semibold text-sm",
                    inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
                  )}
                >
                  {step.title}
                </p>
              </div>
              {step.body && isActive && !splitWithImage ? (
                <p
                  className={cn(
                    "mt-1 leading-relaxed",
                    inPresentation ? "text-sm text-slate-700" : "text-xs text-slate-600 dark:text-slate-300",
                  )}
                >
                  {step.body}
                </p>
              ) : null}
            </div>
            {i < steps.length - 1 && layout === "compact" ? (
              <ArrowRight className="h-4 w-4 text-violet-400 shrink-0 self-center hidden sm:block" />
            ) : null}
          </motion.button>
        )
      })}
    </div>
  )

  if (layout === "horizontal") {
    return (
      <CampModernSurface className="space-y-4">
        <BlockHeader title={title} subtitle={intro} />
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-start justify-center gap-2 sm:gap-x-2 sm:gap-y-3">
          {steps.map((step, i) => {
            const Icon = resolveIcon(step.icon)
            const isActive = active === i
            return (
              <div key={step.title} className="flex items-center sm:contents">
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex flex-col items-center text-center w-full sm:w-[104px] rounded-xl p-2 sm:p-3 transition-all min-h-[88px]",
                    isActive
                      ? "bg-violet-500/15 ring-2 ring-violet-500/45 shadow-md scale-[1.02] sm:scale-[1.03] z-10"
                      : "bg-white/70 dark:bg-white/[0.04] ring-1 ring-slate-200/70 hover:ring-violet-400/35",
                  )}
                >
                  <span
                    className={cn(
                      "size-8 sm:size-9 rounded-xl flex items-center justify-center mb-1.5",
                      isActive ? "bg-violet-600 text-white" : "bg-violet-500/15 text-violet-600",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <p
                    className={cn(
                      "text-[11px] sm:text-xs font-bold leading-tight px-0.5",
                      inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
                    )}
                  >
                    {step.title}
                  </p>
                </button>
                {i < steps.length - 1 ? (
                  <ArrowRight className="h-3.5 w-3.5 text-violet-400/60 shrink-0 mx-0.5 hidden sm:block" />
                ) : null}
              </div>
            )
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <StepDetailPanel step={steps[active]} stepIndex={active} totalSteps={steps.length} />
          </motion.div>
        </AnimatePresence>
        {footer ? <p className="text-sm text-slate-600 dark:text-slate-400">{footer}</p> : null}
      </CampModernSurface>
    )
  }

  return (
    <CampModernSurface padding="none">
      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6 p-5 sm:p-6 lg:items-stretch">
        <div className="min-w-0 flex flex-col space-y-3">
          <BlockHeader title={title} subtitle={intro} />
          {stepList}
        </div>
        <div className="min-w-0 flex flex-col gap-3 min-h-[280px] lg:min-h-0">
          {imageUrl ? (
            <div className={cn("rounded-xl ring-1 flex flex-col", inPresentation ? "ring-slate-200/70 bg-white" : "ring-slate-200/70 dark:ring-white/10 bg-white dark:bg-slate-900")}>
              <CampScaledImage
                src={imageUrl}
                alt={imageCaption ?? title ?? "Illustration"}
                aspectClass="aspect-[4/3]"
                className="border-0 rounded-t-xl rounded-b-none"
                imgClassName={cn("object-contain p-3", inPresentation ? "bg-white" : "bg-white dark:bg-slate-900")}
              />
              {activeStep?.body ? (
                <div className="px-4 py-3 border-t border-slate-200/70 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{activeStep.title}</p>
                  <p
                    className={cn(
                      "mt-1.5 leading-relaxed",
                      inPresentation ? "text-sm text-slate-700" : "text-xs text-slate-600 dark:text-slate-300",
                    )}
                  >
                    {activeStep.body}
                  </p>
                </div>
              ) : null}
              {imageCaption ? (
                <p className={cn("px-4 pb-4 pt-0 text-sm font-medium leading-snug", inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-300")}>
                  {imageCaption}
                </p>
              ) : null}
            </div>
          ) : (
            <FlowVisualPanel steps={steps} active={active} title={title} onStepSelect={setActive} />
          )}
        </div>
        {footer ? (
          <p className="lg:col-span-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-200/60 dark:border-white/10">
            {footer}
          </p>
        ) : null}
      </div>
    </CampModernSurface>
  )
}

export function CampWaveCardsBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const waves =
    (content.waves as Array<{ label: string; title: string; body: string }>) ??
    (content.cards as Array<{ label: string; title: string; body: string }>) ??
    []
  const timeline =
    (content.timeline as Array<{ era: string; milestone: string; why: string }>) ?? []
  const title = content.title ? String(content.title) : undefined
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const footer = content.footer ? String(content.footer) : undefined

  const waveColors = [
    "from-sky-500/15 to-blue-500/5 border-sky-500/20",
    "from-violet-500/15 to-purple-500/5 border-violet-500/20",
    "from-fuchsia-500/15 to-pink-500/5 border-fuchsia-500/20",
  ]

  return (
    <CampModernSurface className="space-y-5">
      <BlockHeader title={title} subtitle={subtitle} />
      {timeline.length > 0 ? (
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
          <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {timeline.slice(0, 6).map((item) => (
              <div
                key={item.milestone}
                className="w-[200px] sm:w-auto rounded-xl p-3.5 bg-slate-50/90 dark:bg-white/[0.03] ring-1 ring-slate-200/70 dark:ring-white/10"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  {item.era}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.milestone}</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.why}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
        {waves.map((wave, i) => (
          <motion.div
            key={wave.title}
            initial={{ opacity: inPresentation ? 1 : 0, y: inPresentation ? 0 : 10 }}
            animate={inPresentation ? { opacity: 1, y: 0 } : undefined}
            whileInView={inPresentation ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={cn(
              "rounded-xl p-4 sm:p-5 bg-gradient-to-br ring-1",
              waveColors[i % waveColors.length],
            )}
          >
            <span className="inline-flex items-center justify-center size-7 rounded-full bg-white/80 dark:bg-white/10 text-xs font-bold text-violet-700 dark:text-violet-300 mb-2">
              {wave.label ?? i + 1}
            </span>
            <p className="font-bold text-slate-900 dark:text-white">{wave.title}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{wave.body}</p>
          </motion.div>
        ))}
      </div>
      {footer ? <p className="text-sm text-slate-600 dark:text-slate-400 italic">{footer}</p> : null}
    </CampModernSurface>
  )
}

export function CampConceptCardsBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const cards = (content.cards as CardItem[]) ?? []
  const title = content.title ? String(content.title) : undefined
  const subtitle = content.subtitle ? String(content.subtitle) : undefined

  return (
    <CampModernSurface>
      <BlockHeader title={title} subtitle={subtitle} />
      <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
        {cards.map((card, i) => {
          const Icon = resolveIcon(card.icon)
          return (
            <div
              key={card.title}
              className={cn(
                "rounded-xl p-4 ring-1",
                inPresentation
                  ? "bg-gradient-to-br from-white to-slate-50/50 ring-slate-200/70"
                  : "bg-gradient-to-br from-white to-slate-50/50 dark:from-white/[0.05] dark:to-transparent ring-slate-200/70 dark:ring-white/10",
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Icon className={cn("h-4 w-4", inPresentation ? "text-violet-600" : "text-violet-600 dark:text-violet-400")} />
                </div>
                <p className={cn("font-semibold text-sm sm:text-base", inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white")}>
                  {card.title}
                </p>
              </div>
              <p className={cn("text-sm leading-relaxed", inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-300")}>
                {card.body ?? card.description}
              </p>
            </div>
          )
        })}
      </div>
    </CampModernSurface>
  )
}

export function CampDualModelCompareBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title ? String(content.title) : "Traditional vs AI"
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const traditional = (content.traditional as { title?: string; body?: string; example?: string }) ?? {}
  const ai = (content.ai as { title?: string; body?: string; example?: string }) ?? {}
  const rows = (content.rows as Array<{ label: string; traditional: string; ai: string }>) ?? []

  return (
    <CampModernSurface className="space-y-4">
      <BlockHeader title={title} subtitle={subtitle} />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl p-4 sm:p-5 bg-gradient-to-br from-slate-100/90 to-slate-50 dark:from-slate-800/60 dark:to-slate-900/40 ring-1 ring-slate-200/80 dark:ring-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <p className="font-bold text-slate-900 dark:text-white">{traditional.title ?? "Traditional Programming"}</p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{traditional.body}</p>
          {traditional.example ? (
            <pre className="mt-3 rounded-lg bg-slate-900/90 dark:bg-black/40 text-emerald-300 text-xs p-3 overflow-x-auto font-mono">
              {traditional.example}
            </pre>
          ) : null}
        </div>
        <div className="rounded-xl p-4 sm:p-5 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 ring-1 ring-violet-500/25">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <p className="font-bold text-slate-900 dark:text-white">{ai.title ?? "AI / Machine Learning"}</p>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{ai.body}</p>
          {ai.example ? (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {ai.example.split("\n").filter(Boolean).map((line) => (
                <li key={line} className="flex gap-2">
                  <ChevronRight className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                  <span>{line.replace(/^[-•]\s*/, "")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {rows.length > 0 ? (
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="rounded-xl overflow-hidden ring-1 ring-slate-200/70 dark:ring-white/10 min-w-[min(100%,520px)]">
          <div className="grid grid-cols-3 bg-slate-100/90 dark:bg-slate-800/80 text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
            <div className="px-3 py-2.5" />
            <div className="px-3 py-2.5 border-l border-slate-200/70 dark:border-white/10">Traditional</div>
            <div className="px-3 py-2.5 border-l border-slate-200/70 dark:border-white/10">AI (ML)</div>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-3 border-t border-slate-200/70 dark:border-white/10 text-sm">
              <div className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200">{row.label}</div>
              <div className="px-3 py-2.5 text-slate-600 dark:text-slate-400 border-l border-slate-200/70 dark:border-white/10">
                {row.traditional}
              </div>
              <div className="px-3 py-2.5 text-slate-600 dark:text-slate-400 border-l border-slate-200/70 dark:border-white/10">
                {row.ai}
              </div>
            </div>
          ))}
        </div>
        </div>
      ) : null}
    </CampModernSurface>
  )
}

export function CampAiTypeCardsBlock({ content }: { content: Record<string, unknown> }) {
  const types =
    (content.types as Array<{ name: string; badge?: string; summary: string; example?: string }>) ??
    (content.cards as Array<{ name: string; badge?: string; summary: string; example?: string }>) ??
    []
  const title = content.title ? String(content.title) : undefined
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const [expanded, setExpanded] = useState<number | null>(0)

  return (
    <CampModernSurface>
      <BlockHeader title={title} subtitle={subtitle} />
      <div className="space-y-2.5">
        {types.map((t, i) => {
          const open = expanded === i
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => setExpanded(open ? null : i)}
              className={cn(
                "w-full text-left rounded-xl p-4 transition-all duration-200",
                open
                  ? "bg-violet-500/10 ring-2 ring-violet-500/35 shadow-md"
                  : "bg-white/70 dark:bg-white/[0.03] ring-1 ring-slate-200/70 dark:ring-white/10 hover:ring-violet-400/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{t.name}</span>
                    {t.badge ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                        {t.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.summary}</p>
                </div>
                <ChevronRight className={cn("h-5 w-5 text-violet-500 shrink-0 transition-transform", open && "rotate-90")} />
              </div>
              {open && t.example ? (
                <p className="mt-3 pt-3 border-t border-violet-500/20 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-violet-700 dark:text-violet-300">Example: </span>
                  {t.example}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </CampModernSurface>
  )
}

export function CampIndustrialCompareBlock({ content }: { content: Record<string, unknown> }) {
  const inPresentation = useCampPresentation()
  const title = content.title ? String(content.title) : undefined
  const intro = content.intro ? String(content.intro) : undefined
  const imageUrl = content.imageUrl ? String(content.imageUrl) : undefined
  const imageCaption = content.imageCaption ? String(content.imageCaption) : undefined
  const bullets = (content.bullets as string[]) ?? []
  const rows = (content.rows as Array<{ left: string; right: string }>) ?? []

  return (
    <CampModernSurface padding="none">
      <div className="grid lg:grid-cols-2 gap-0">
        <div className="p-5 sm:p-6 space-y-4 min-w-0">
          <BlockHeader title={title} subtitle={intro} />
          <div className="grid sm:grid-cols-2 gap-2.5">
            {bullets.map((b) => (
              <div
                key={b}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm ring-1",
                  inPresentation
                    ? "text-slate-700 bg-slate-50/90 ring-slate-200/60"
                    : "text-slate-700 dark:text-slate-300 bg-slate-50/90 dark:bg-white/[0.03] ring-slate-200/60 dark:ring-white/10",
                )}
              >
                {b}
              </div>
            ))}
          </div>
          {rows.length > 0 ? (
            <div className="rounded-xl overflow-x-auto ring-1 ring-slate-200/70 dark:ring-white/10 text-sm min-w-0">
              <div className="grid grid-cols-2 min-w-[280px] bg-violet-500/10 font-semibold text-xs uppercase tracking-wide text-slate-800">
                <div className="px-3 py-2">Industrial Revolution</div>
                <div className="px-3 py-2 border-l border-slate-200/50">AI Age (Today)</div>
              </div>
              {rows.map((row, index) => (
                <div key={`${index}-${row.left}`} className="grid grid-cols-2 border-t border-slate-200/60 dark:border-white/10">
                  <div
                    className={cn(
                      "px-3 py-2",
                      inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {row.left}
                  </div>
                  <div
                    className={cn(
                      "px-3 py-2 border-l border-slate-200/60 dark:border-white/10",
                      inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-300",
                    )}
                  >
                    {row.right}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {imageUrl ? (
          <div className="p-5 sm:p-6 lg:pl-0 flex flex-col">
            <div className="flex-1 min-h-[200px] rounded-xl overflow-hidden ring-1 ring-slate-200/70 dark:ring-white/10 bg-white dark:bg-slate-900">
              <CampScaledImage
                src={imageUrl}
                alt={imageCaption ?? title ?? ""}
                aspectClass="aspect-[4/3]"
                imgClassName="object-contain p-3 bg-white dark:bg-slate-900"
              />
            </div>
            {imageCaption ? (
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">{imageCaption}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </CampModernSurface>
  )
}

type DeckSection = {
  title: string
  icon?: string
  body?: string
  bullets?: string[]
  accent?: "violet" | "emerald" | "amber" | "rose" | "sky"
}

const DECK_ACCENT: Record<NonNullable<DeckSection["accent"]>, string> = {
  violet: "from-violet-500/12 to-indigo-500/5 ring-violet-500/25",
  emerald: "from-emerald-500/12 to-teal-500/5 ring-emerald-500/25",
  amber: "from-amber-500/12 to-orange-500/5 ring-amber-500/25",
  rose: "from-rose-500/12 to-pink-500/5 ring-rose-500/25",
  sky: "from-sky-500/12 to-blue-500/5 ring-sky-500/25",
}

export function CampTopicDeckBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title ? String(content.title) : undefined
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const footer = content.footer ? String(content.footer) : undefined
  const imageUrl = content.imageUrl ? String(content.imageUrl) : undefined
  const imageCaption = content.imageCaption ? String(content.imageCaption) : undefined
  const sections = (content.sections as DeckSection[]) ?? []
  const columns = Number(content.columns ?? 2)
  const rows =
    (content.comparisonRows as Array<{ left: string; right: string }>) ?? []
  const comparisonLabels = (content.comparisonLabels as { left?: string; right?: string }) ?? {}

  return (
    <CampModernSurface className="space-y-5">
      <BlockHeader title={title} subtitle={subtitle} />
      {imageUrl ? (
        <div className="rounded-xl overflow-hidden ring-1 ring-slate-200/70 dark:ring-white/10 bg-white">
          <CampScaledImage
            src={imageUrl}
            alt={imageCaption ?? title ?? "Illustration"}
            aspectClass="aspect-[16/10]"
            imgClassName="object-contain p-3 bg-white"
          />
          {imageCaption ? (
            <p className="px-4 pb-4 pt-1 text-sm font-medium text-slate-700 leading-snug">{imageCaption}</p>
          ) : null}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="rounded-xl overflow-hidden ring-1 ring-slate-200/70 dark:ring-white/10 text-sm">
          <div className="grid grid-cols-2 bg-slate-100 text-slate-800 border-b border-slate-200/80 font-semibold text-xs uppercase tracking-wide">
            <div className="px-3 py-2.5">{comparisonLabels.left ?? "Traditional AI"}</div>
            <div className="px-3 py-2.5 border-l border-white/20">{comparisonLabels.right ?? "Generative AI"}</div>
          </div>
          {rows.map((row, index) => (
            <div key={`${index}-${row.left}`} className="grid grid-cols-2 border-t border-slate-200/70 dark:border-white/10">
              <div className="px-3 py-2.5 text-slate-800">{row.left}</div>
              <div className="px-3 py-2.5 border-l border-slate-200/70 dark:border-white/10 text-slate-800">{row.right}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          "grid gap-3 sm:gap-4",
          columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {sections.map((section) => {
          const Icon = resolveIcon(section.icon)
          const accent = DECK_ACCENT[section.accent ?? "violet"]
          return (
            <div
              key={section.title}
              className={cn("rounded-xl p-4 bg-gradient-to-br ring-1", accent)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="size-8 rounded-lg bg-white/80 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-violet-700" />
                </div>
                <p className="font-semibold text-slate-900 text-sm sm:text-base leading-snug">{section.title}</p>
              </div>
              {section.body ? (
                <p className="text-sm text-slate-700 leading-relaxed">{section.body}</p>
              ) : null}
              {section.bullets?.length ? (
                <ul className="mt-2 space-y-1.5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-sm text-slate-700 leading-snug">
                      <span className="text-violet-600 shrink-0 mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
      {footer ? (
        <p className="text-sm font-medium text-slate-800 border-t border-slate-200/70 pt-4 leading-relaxed">{footer}</p>
      ) : null}
    </CampModernSurface>
  )
}

export function CampHandsOnMissionsBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title ? String(content.title) : "Hands-On Activities"
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const activities =
    (content.activities as Array<{
      id: string
      label: string
      title: string
      duration?: string
      icon?: string
      summary?: string
      steps?: string[]
      compare?: { weak: string; strong: string }
      footer?: string
      tags?: string[]
      accent?: DeckSection["accent"]
      wide?: boolean
    }>) ?? []

  return (
    <CampModernSurface className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BlockHeader title={title} subtitle={subtitle} />
        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          {activities.length} missions
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {activities.map((activity) => {
          const Icon = resolveIcon(activity.icon)
          const accent = DECK_ACCENT[activity.accent ?? "violet"]
          return (
            <div
              key={activity.id}
              className={cn(
                "rounded-2xl overflow-hidden ring-1 ring-slate-200/70 bg-white flex flex-col",
                activity.wide && "md:col-span-2",
              )}
            >
              <div className={cn("px-4 py-3 bg-gradient-to-r text-slate-900", accent)}>
                <div className="flex items-start gap-3">
                  <span className="size-10 shrink-0 rounded-xl bg-white/90 flex items-center justify-center text-lg font-black text-violet-700 shadow-sm">
                    {activity.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="h-4 w-4 text-violet-700 shrink-0" />
                      <p className="font-bold text-sm sm:text-base leading-snug">{activity.title}</p>
                      {activity.duration ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-white/80 text-violet-800 px-2 py-0.5 rounded-full">
                          {activity.duration}
                        </span>
                      ) : null}
                    </div>
                    {activity.summary ? (
                      <p className="mt-1 text-sm text-slate-700 leading-relaxed">{activity.summary}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3 flex-1">
                {activity.steps?.length ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {activity.steps.map((step, i) => (
                      <div
                        key={step}
                        className="flex items-start gap-2 rounded-lg bg-slate-50 ring-1 ring-slate-200/70 px-3 py-2.5"
                      >
                        <span className="size-6 shrink-0 rounded-md bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <p className="text-sm text-slate-800 leading-snug">{step}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {activity.compare ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl ring-1 ring-rose-200 bg-gradient-to-br from-rose-50 to-orange-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-rose-800 mb-2">Weak prompt</p>
                      <p className="text-sm text-slate-800 italic leading-relaxed">&ldquo;{activity.compare.weak}&rdquo;</p>
                    </div>
                    <div className="rounded-xl ring-1 ring-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 mb-2">Stronger prompt</p>
                      <p className="text-sm text-slate-800 leading-relaxed">&ldquo;{activity.compare.strong}&rdquo;</p>
                    </div>
                  </div>
                ) : null}
                {activity.footer ? (
                  <p className="text-sm text-slate-700 leading-relaxed">{activity.footer}</p>
                ) : null}
                {activity.tags?.length ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activity.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium text-violet-800 bg-violet-100 px-2 py-1 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </CampModernSurface>
  )
}

type FlipCard = { id: string; front: string; back: string }

export function CampFlashcardCarouselBlock({ content }: { content: Record<string, unknown> }) {
  const cards = (content.cards as FlipCard[]) ?? []
  const title = String(content.title ?? "Flashcard Review")
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const card = cards[index]

  if (!card) return null

  const go = (next: number) => {
    setIndex(next)
    setFlipped(false)
  }

  return (
    <CampModernSurface className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          {index + 1} / {cards.length}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-[180px] rounded-2xl ring-2 ring-violet-500/30 bg-gradient-to-br from-violet-500/10 to-indigo-500/5 p-6 text-left transition-all hover:ring-violet-500/50 focus:outline-none focus-visible:ring-violet-500"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 mb-3">
          {flipped ? "Definition" : "Term"}
        </p>
        <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
        <p className="mt-4 text-xs font-medium text-slate-600">Tap to flip</p>
      </button>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <div className="flex gap-1.5">
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Card ${i + 1}`}
              onClick={() => go(i)}
              className={cn(
                "size-2 rounded-full transition-colors",
                i === index ? "bg-violet-600" : "bg-slate-300 hover:bg-violet-300",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={index >= cards.length - 1}
          onClick={() => go(index + 1)}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </CampModernSurface>
  )
}

export function CampMythFactCarouselBlock({ content }: { content: Record<string, unknown> }) {
  const cards = (content.cards as FlipCard[]) ?? []
  const title = String(content.title ?? "Myth vs Fact")
  const [index, setIndex] = useState(0)
  const [showReality, setShowReality] = useState(false)
  const card = cards[index]

  if (!card) return null

  const go = (next: number) => {
    setIndex(next)
    setShowReality(false)
  }

  return (
    <CampModernSurface className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          {index + 1} / {cards.length}
        </span>
      </div>
      <div
        className={cn(
          "rounded-2xl ring-2 p-6 min-h-[160px] transition-colors",
          showReality
            ? "ring-emerald-500/40 bg-gradient-to-br from-emerald-500/12 to-teal-500/5"
            : "ring-rose-500/35 bg-gradient-to-br from-rose-500/12 to-orange-500/5",
        )}
      >
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-widest mb-3",
            showReality ? "text-emerald-800" : "text-rose-800",
          )}
        >
          {showReality ? "Reality" : "Myth"}
        </p>
        <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
          {showReality ? card.back : card.front}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowReality((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          {showReality ? "Show myth again" : "Reveal reality"}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className="rounded-lg p-2 text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
            aria-label="Previous myth"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index >= cards.length - 1}
            onClick={() => go(index + 1)}
            className="rounded-lg p-2 text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
            aria-label="Next myth"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </CampModernSurface>
  )
}

type PromptCriterion = {
  id: string
  label: string
  letter?: string
  hint: string
  keywords: string[]
}

type PromptScenario = {
  id: string
  title: string
  weakPrompt: string
  instructorBrief: string
  criteria: PromptCriterion[]
  modelAnswer: string
  strongThreshold?: number
}

function normalizePromptText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ")
}

function criterionMatches(userPrompt: string, keywords: string[]): boolean {
  const normalized = normalizePromptText(userPrompt)
  if (!normalized.trim()) return false
  return keywords.some((kw) => {
    const k = kw.toLowerCase().trim()
    if (!k) return false
    return normalized.includes(k.replace(/[^\w\s]/g, " "))
  })
}

function scoreLabel(matched: number, total: number, threshold: number): string {
  if (matched >= total) return "Excellent — you built a strong R-T-C-A-C-F prompt!"
  if (matched >= threshold) return "Solid work — you hit most of the key components."
  if (matched >= Math.ceil(total / 2)) return "Good start — compare with the model answer and try again."
  return "Keep going — start with Role, Task, and Audience."
}

export function CampPromptWorkshopBlock({ content }: { content: Record<string, unknown> }) {
  const title = content.title ? String(content.title) : "Prompt Makeover Lab"
  const subtitle = content.subtitle ? String(content.subtitle) : undefined
  const scenarios = (content.scenarios as PromptScenario[]) ?? []
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState("")
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const inPresentation = useCampPresentation()

  const scenario = scenarios[index]
  if (!scenario) return null

  const results = scenario.criteria.map((c) => ({
    ...c,
    hit: criterionMatches(draft, c.keywords),
  }))
  const matched = results.filter((r) => r.hit).length
  const total = results.length
  const threshold = scenario.strongThreshold ?? Math.max(4, total - 1)

  const resetForScenario = (next: number) => {
    setIndex(next)
    setDraft("")
    setChecked(false)
    setRevealed(false)
  }

  const handleCheck = () => {
    if (!draft.trim()) return
    setChecked(true)
  }

  return (
    <CampModernSurface className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <BlockHeader title={title} subtitle={subtitle} />
        {scenarios.length > 1 ? (
          <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Challenge {index + 1} / {scenarios.length}
          </span>
        ) : null}
      </div>

      {scenarios.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => resetForScenario(i)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all",
                i === index
                  ? "bg-violet-600 text-white shadow-md shadow-violet-500/25"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div
          initial={inPresentation ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl ring-1 ring-amber-300/80 bg-amber-50 p-4 sm:p-5 space-y-2"
        >
          <div className="flex items-center gap-2 text-amber-900">
            <Circle className="h-4 w-4 fill-amber-500 text-amber-500 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">Weak sample prompt</p>
          </div>
          <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed italic">
            &ldquo;{scenario.weakPrompt}&rdquo;
          </p>
        </motion.div>

        <motion.div
          initial={inPresentation ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl ring-1 ring-sky-300/80 bg-sky-50 p-4 sm:p-5 space-y-2"
        >
          <div className="flex items-center gap-2 text-sky-900">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wide">What we had in mind</p>
          </div>
          <p className="text-sm sm:text-[15px] font-medium text-slate-800 leading-relaxed">
            {scenario.instructorBrief}
          </p>
        </motion.div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600" />
          Build with R-T-C-A-C-F — include these ideas in your prompt
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {scenario.criteria.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-lg px-3 py-2.5 ring-1 transition-colors",
                checked && criterionMatches(draft, c.keywords)
                  ? "bg-emerald-50 ring-emerald-300/80"
                  : checked
                    ? "bg-slate-50 ring-slate-200/80"
                    : "bg-white ring-slate-200/80",
              )}
            >
              <div className="flex items-center gap-2">
                {checked ? (
                  criterionMatches(draft, c.keywords) ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                  )
                ) : (
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[10px] font-bold text-violet-800">
                    {c.letter ?? c.label.slice(0, 1)}
                  </span>
                )}
                <p className="text-sm font-semibold text-slate-900">{c.label}</p>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-snug pl-8">{c.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-800">
          <PenLine className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-semibold">Your stronger prompt</p>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (checked) setChecked(false)
            if (revealed) setRevealed(false)
          }}
          placeholder="You are a… Explain… for a ninth-grade student… Use… Do not…"
          rows={5}
          className="text-sm sm:text-[15px] text-slate-800 bg-white border-slate-200/80 focus-visible:ring-violet-500/40 min-h-[120px]"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleCheck}
            disabled={!draft.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Check my prompt
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRevealed(true)}
            disabled={!checked}
            className="font-semibold text-slate-800 border-slate-300"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Reveal instructor answer
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {checked ? (
          <motion.div
            key="score"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl ring-1 ring-violet-300/60 bg-violet-50/80 p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-violet-500/40">
                <span className="text-xl font-bold text-violet-800">
                  {matched}/{total}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{scoreLabel(matched, total, threshold)}</p>
                <p className="mt-1 text-sm text-slate-700">
                  Green checks mean your prompt includes keywords for that component — same ingredients instructors look for.
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {revealed ? (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Instructor model answer
            </p>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl ring-1 ring-slate-200/80 bg-white p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Your version</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{draft.trim()}</p>
              </div>
              <div className="rounded-xl ring-1 ring-emerald-300/80 bg-emerald-50 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-900 mb-2">Model answer</p>
                <p className="text-sm font-medium text-slate-900 leading-relaxed">{scenario.modelAnswer}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Compare line by line: Role sets voice, Task sets action, Context and Audience calibrate depth, Constraints
              prevent bad shortcuts, Format shapes what you get back.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {scenarios.length > 1 ? (
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => resetForScenario(index - 1)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={index >= scenarios.length - 1}
            onClick={() => resetForScenario(index + 1)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
          >
            Next challenge
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </CampModernSurface>
  )
}
