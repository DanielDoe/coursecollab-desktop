/** Topic-aware visuals for flashcard study (immersive + deck accents). */

export type FlashcardTopicTheme = {
  id: string
  label: string
  gradient: string
  mesh: string
  accent: string
  accentSoft: string
  ring: string
  cardFront: string
  cardBack: string
}

const DEFAULT_THEME: FlashcardTopicTheme = {
  id: "default",
  label: "Study",
  gradient: "from-slate-950 via-violet-950/90 to-slate-950",
  mesh: "bg-[radial-gradient(ellipse_at_20%_20%,rgba(245,158,11,0.18),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(139,92,246,0.15),transparent_45%)]",
  accent: "text-amber-300",
  accentSoft: "bg-amber-500/15 text-amber-200",
  ring: "text-amber-400",
  cardFront: "border-amber-400/25 bg-gradient-to-br from-slate-900/95 to-amber-950/30",
  cardBack: "border-emerald-400/25 bg-gradient-to-br from-emerald-950/50 to-teal-950/40",
}

const TOPIC_THEMES: { match: RegExp; theme: Omit<FlashcardTopicTheme, "id" | "label"> & { label: string } }[] = [
  {
    match: /ac|phasor|impedance|power/i,
    label: "AC Analysis",
    gradient: "from-indigo-950 via-violet-950 to-slate-950",
    mesh: "bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.22),transparent_55%),radial-gradient(ellipse_at_70%_75%,rgba(167,139,250,0.12),transparent_50%)]",
    accent: "text-indigo-300",
    accentSoft: "bg-indigo-500/15 text-indigo-200",
    ring: "text-indigo-400",
    cardFront: "border-indigo-400/30 bg-gradient-to-br from-slate-900/95 to-indigo-950/40",
    cardBack: "border-violet-400/25 bg-gradient-to-br from-violet-950/50 to-indigo-950/35",
  },
  {
    match: /op.?amp|first.?order|rc|rl|transient/i,
    label: "Circuits",
    gradient: "from-teal-950 via-cyan-950 to-slate-950",
    mesh: "bg-[radial-gradient(ellipse_at_25%_30%,rgba(20,184,166,0.2),transparent_50%),radial-gradient(ellipse_at_75%_70%,rgba(6,182,212,0.12),transparent_45%)]",
    accent: "text-teal-300",
    accentSoft: "bg-teal-500/15 text-teal-200",
    ring: "text-teal-400",
    cardFront: "border-teal-400/25 bg-gradient-to-br from-slate-900/95 to-teal-950/35",
    cardBack: "border-cyan-400/25 bg-gradient-to-br from-cyan-950/45 to-teal-950/30",
  },
  {
    match: /node|mesh|dc|chapter.?3/i,
    label: "DC Analysis",
    gradient: "from-blue-950 via-slate-950 to-slate-950",
    mesh: "bg-[radial-gradient(ellipse_at_40%_15%,rgba(59,130,246,0.18),transparent_50%),radial-gradient(ellipse_at_60%_85%,rgba(96,165,250,0.1),transparent_45%)]",
    accent: "text-blue-300",
    accentSoft: "bg-blue-500/15 text-blue-200",
    ring: "text-blue-400",
    cardFront: "border-blue-400/25 bg-gradient-to-br from-slate-900/95 to-blue-950/35",
    cardBack: "border-sky-400/25 bg-gradient-to-br from-sky-950/45 to-blue-950/30",
  },
]

export function resolveFlashcardTopicTheme(topic?: string | null, deckTitle?: string): FlashcardTopicTheme {
  const haystack = `${topic ?? ""} ${deckTitle ?? ""}`.trim()
  if (!haystack) return DEFAULT_THEME

  for (const entry of TOPIC_THEMES) {
    if (entry.match.test(haystack)) {
      return { id: entry.label.toLowerCase().replace(/\s+/g, "-"), ...entry }
    }
  }

  return DEFAULT_THEME
}
