/**
 * Selectable semantic color schemes for sidebar groups & module chrome.
 * Primary / success / warning / danger still follow the active brand theme.
 */

import type { SemanticRole } from "@/lib/appearance/semantic-tokens"

export type SemanticPaletteId =
  | "vivid"
  | "pastel"
  | "corporate"
  | "neon"
  | "earth"
  | "executive-navy"
  | "platinum-suite"
  | "heritage-wine"
  | "meridian-teal"
  | "obsidian-gold"
  | "cougar-crimson"
  | "university-of-houston-steel"
  | "pvamu-purple"
  | "pvamu-gold"
  | "professional-crimson"
  | "copper-luxe"
  | "forest-mist"
  | "aurora"
  | "liquid-glass"
  | "arctic"

export type ModuleHueMap = Partial<Record<SemanticRole, string>>

export type SemanticPaletteDefinition = {
  id: SemanticPaletteId
  name: string
  tagline: string
  /** Module role base hues — merged over DEFAULT_MODULE_HUES at runtime */
  moduleHues: ModuleHueMap
  /** Sidebar preview dots: learning, assessments, collaboration, rewards, course info */
  previewSwatches: [string, string, string, string, string]
}

export const DEFAULT_SEMANTIC_PALETTE_ID: SemanticPaletteId = "vivid"

export const VALID_SEMANTIC_PALETTE_IDS: SemanticPaletteId[] = [
  "vivid",
  "pastel",
  "corporate",
  "neon",
  "earth",
  "executive-navy",
  "platinum-suite",
  "heritage-wine",
  "meridian-teal",
  "obsidian-gold",
  "cougar-crimson",
  "university-of-houston-steel",
  "pvamu-purple",
  "pvamu-gold",
  "professional-crimson",
  "copper-luxe",
  "forest-mist",
  "aurora",
  "liquid-glass",
  "arctic",
]

/** Default module hues (Vivid Spectrum) */
export const DEFAULT_MODULE_HUES: ModuleHueMap = {
  homework: "#F97316",
  attendance: "#38BDF8",
  quiz: "#9333EA",
  codebench: "#6366F1",
  ai: "#06B6D4",
  analytics: "#EC4899",
  calendar: "#0284C7",
  messages: "#0D9488",
  discussion: "#14B8A6",
  reward: "#EAB308",
  projects: "#7C3AED",
  practice: "#16A34A",
  info: "#2563EB",
  neutral: "#64748B",
}

export const SEMANTIC_PALETTE_DEFINITIONS: SemanticPaletteDefinition[] = [
  {
    id: "vivid",
    name: "Vivid Spectrum",
    tagline: "Bold, well-separated hues for each sidebar group",
    moduleHues: {},
    previewSwatches: ["#16A34A", "#F97316", "#0D9488", "#EAB308", "#0284C7"],
  },
  {
    id: "pastel",
    name: "Soft Pastel",
    tagline: "Gentle tints — easy on the eyes, still distinct",
    moduleHues: {
      homework: "#FB923C",
      attendance: "#7DD3FC",
      quiz: "#C4B5FD",
      codebench: "#A5B4FC",
      ai: "#67E8F9",
      analytics: "#F9A8D4",
      calendar: "#93C5FD",
      messages: "#5EEAD4",
      discussion: "#99F6E4",
      reward: "#FDE047",
      projects: "#DDD6FE",
      practice: "#86EFAC",
      info: "#93C5FD",
      neutral: "#94A3B8",
    },
    previewSwatches: ["#86EFAC", "#FB923C", "#5EEAD4", "#FDE047", "#93C5FD"],
  },
  {
    id: "corporate",
    name: "Corporate",
    tagline: "Restrained blues, teals, and ambers for enterprise UI",
    moduleHues: {
      homework: "#D97706",
      attendance: "#0284C7",
      quiz: "#4338CA",
      codebench: "#1E40AF",
      ai: "#0369A1",
      analytics: "#BE185D",
      calendar: "#1D4ED8",
      messages: "#0E7490",
      discussion: "#0891B2",
      reward: "#CA8A04",
      projects: "#3730A3",
      practice: "#059669",
      info: "#1E3A8A",
      neutral: "#475569",
    },
    previewSwatches: ["#059669", "#D97706", "#0E7490", "#CA8A04", "#1D4ED8"],
  },
  {
    id: "neon",
    name: "Neon Pulse",
    tagline: "High-energy saturated accents for a modern look",
    moduleHues: {
      homework: "#FF5722",
      attendance: "#00BCD4",
      quiz: "#E040FB",
      codebench: "#536DFE",
      ai: "#00E5FF",
      analytics: "#FF4081",
      calendar: "#2979FF",
      messages: "#00E676",
      discussion: "#1DE9B6",
      reward: "#FFEA00",
      projects: "#7C4DFF",
      practice: "#00E676",
      info: "#448AFF",
      neutral: "#78909C",
    },
    previewSwatches: ["#00E676", "#FF5722", "#1DE9B6", "#FFEA00", "#2979FF"],
  },
  {
    id: "earth",
    name: "Earth & Clay",
    tagline: "Warm sage, terracotta, and dusty blues",
    moduleHues: {
      homework: "#C17F59",
      attendance: "#6B9BC3",
      quiz: "#9B6B8E",
      codebench: "#7B6FA8",
      ai: "#7BA3A8",
      analytics: "#C2788E",
      calendar: "#6B9BC3",
      messages: "#5B8A8A",
      discussion: "#6A9595",
      reward: "#D4A853",
      projects: "#8B7BA8",
      practice: "#6B8F71",
      info: "#5A7FA8",
      neutral: "#8B8178",
    },
    previewSwatches: ["#6B8F71", "#C17F59", "#5B8A8A", "#D4A853", "#6B9BC3"],
  },
  {
    id: "executive-navy",
    name: "Executive Navy",
    tagline: "Boardroom blues, deep teals, and burnished amber",
    moduleHues: {
      homework: "#B45309",
      attendance: "#1E40AF",
      quiz: "#312E81",
      codebench: "#1E3A8A",
      ai: "#1E4976",
      analytics: "#9A3412",
      calendar: "#1D4ED8",
      messages: "#0F766E",
      discussion: "#115E59",
      reward: "#A16207",
      projects: "#3730A3",
      practice: "#166534",
      info: "#1E3A8A",
      neutral: "#334155",
    },
    previewSwatches: ["#166534", "#B45309", "#0F766E", "#A16207", "#1D4ED8"],
  },
  {
    id: "platinum-suite",
    name: "Platinum Suite",
    tagline: "Cool silvers and muted steel — quiet luxury",
    moduleHues: {
      homework: "#92764A",
      attendance: "#6B7B8C",
      quiz: "#7C8494",
      codebench: "#5B6B7C",
      ai: "#5B7C99",
      analytics: "#8B7B8B",
      calendar: "#7889A0",
      messages: "#4A6670",
      discussion: "#5C6B73",
      reward: "#9A8C7A",
      projects: "#6E6A7E",
      practice: "#5F7A6A",
      info: "#64748B",
      neutral: "#52525B",
    },
    previewSwatches: ["#5F7A6A", "#92764A", "#4A6670", "#9A8C7A", "#7889A0"],
  },
  {
    id: "heritage-wine",
    name: "Heritage Wine",
    tagline: "Burgundy, cognac, forest green, and antique gold",
    moduleHues: {
      homework: "#9C6644",
      attendance: "#4A5568",
      quiz: "#722F37",
      codebench: "#5C4033",
      ai: "#6B4E71",
      analytics: "#8B4513",
      calendar: "#4A5568",
      messages: "#5C6B73",
      discussion: "#556B5C",
      reward: "#C9A227",
      projects: "#6B3A5D",
      practice: "#4A6741",
      info: "#5C4B51",
      neutral: "#57534E",
    },
    previewSwatches: ["#4A6741", "#9C6644", "#5C6B73", "#C9A227", "#4A5568"],
  },
  {
    id: "meridian-teal",
    name: "Meridian Teal",
    tagline: "Modern enterprise — teal, cyan, and controlled accent warmth",
    moduleHues: {
      homework: "#C2410C",
      attendance: "#0284C7",
      quiz: "#4F46E5",
      codebench: "#0369A1",
      ai: "#0E7490",
      analytics: "#BE123C",
      calendar: "#2563EB",
      messages: "#0D9488",
      discussion: "#0891B2",
      reward: "#B45309",
      projects: "#4338CA",
      practice: "#059669",
      info: "#1D4ED8",
      neutral: "#475569",
    },
    previewSwatches: ["#059669", "#C2410C", "#0D9488", "#B45309", "#2563EB"],
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    tagline: "Charcoal depths with champagne and metallic gold highlights",
    moduleHues: {
      homework: "#8B6914",
      attendance: "#4A5568",
      quiz: "#5B4B8A",
      codebench: "#3D4F5F",
      ai: "#2F4F4F",
      analytics: "#7C4D6E",
      calendar: "#4A5568",
      messages: "#2F4F4F",
      discussion: "#3D5A5A",
      reward: "#D4AF37",
      projects: "#4C3F6B",
      practice: "#3D5A5A",
      info: "#475569",
      neutral: "#3F3F46",
    },
    previewSwatches: ["#3D5A5A", "#8B6914", "#2F4F4F", "#D4AF37", "#4A5568"],
  },
  {
    id: "cougar-crimson",
    name: "Cougar Crimson",
    tagline: "UH red, steel gray, and black — official Cougar palette",
    moduleHues: {
      homework: "#C8102E",
      attendance: "#6D6E71",
      quiz: "#A50D25",
      codebench: "#52525B",
      ai: "#71717A",
      analytics: "#E8193A",
      calendar: "#6D6E71",
      messages: "#78716C",
      discussion: "#57534E",
      reward: "#FFB81C",
      projects: "#9F1239",
      practice: "#166534",
      info: "#1D4ED8",
      neutral: "#6D6E71",
    },
    previewSwatches: ["#166534", "#C8102E", "#6D6E71", "#FFB81C", "#52525B"],
  },
  {
    id: "university-of-houston-steel",
    name: "UH Steel",
    tagline: "Cream, peach, brick red, and navy steel — Color Hunt UH Steel",
    moduleHues: {
      homework: "#B31312",
      attendance: "#2B2A4C",
      quiz: "#EA906C",
      codebench: "#B31312",
      ai: "#2B2A4C",
      analytics: "#EA906C",
      calendar: "#2B2A4C",
      messages: "#B31312",
      discussion: "#EA906C",
      reward: "#EA906C",
      projects: "#2B2A4C",
      practice: "#B31312",
      info: "#2B2A4C",
      neutral: "#6B6A8A",
    },
    previewSwatches: ["#EEE2DE", "#EA906C", "#B31312", "#2B2A4C", "#B31312"],
  },
  {
    id: "pvamu-purple",
    name: "PVAMU Purple",
    tagline: "Panther purple, gold accents, and deep violet modules",
    moduleHues: {
      homework: "#FFB81C",
      attendance: "#4F2D7F",
      quiz: "#7C3AED",
      codebench: "#5B21B6",
      ai: "#6D28D9",
      analytics: "#9333EA",
      calendar: "#3D2363",
      messages: "#0D9488",
      discussion: "#14B8A6",
      reward: "#FFB81C",
      projects: "#4F2D7F",
      practice: "#059669",
      info: "#2563EB",
      neutral: "#64748B",
    },
    previewSwatches: ["#059669", "#FFB81C", "#0D9488", "#FFB81C", "#4F2D7F"],
  },
  {
    id: "pvamu-gold",
    name: "PVAMU Gold",
    tagline: "Gold-forward accents with purple panther depth",
    moduleHues: {
      homework: "#E5A519",
      attendance: "#4F2D7F",
      quiz: "#9B6FD4",
      codebench: "#3D2363",
      ai: "#7C3AED",
      analytics: "#FFB81C",
      calendar: "#F59E0B",
      messages: "#0D9488",
      discussion: "#14B8A6",
      reward: "#FFC94D",
      projects: "#5B21B6",
      practice: "#059669",
      info: "#2563EB",
      neutral: "#78716C",
    },
    previewSwatches: ["#059669", "#E5A519", "#0D9488", "#FFC94D", "#4F2D7F"],
  },
  {
    id: "professional-crimson",
    name: "Professional Crimson",
    tagline: "Executive rose, slate, and controlled amber",
    moduleHues: {
      homework: "#E11D48",
      attendance: "#64748B",
      quiz: "#BE123C",
      codebench: "#475569",
      ai: "#0F766E",
      analytics: "#F43F5E",
      calendar: "#334155",
      messages: "#0D9488",
      discussion: "#14B8A6",
      reward: "#F59E0B",
      projects: "#9F1239",
      practice: "#059669",
      info: "#1D4ED8",
      neutral: "#64748B",
    },
    previewSwatches: ["#059669", "#E11D48", "#0D9488", "#F59E0B", "#64748B"],
  },
  {
    id: "copper-luxe",
    name: "Copper Luxe",
    tagline: "Warm copper, cognac, and bronze module accents",
    moduleHues: {
      homework: "#B45309",
      attendance: "#78716C",
      quiz: "#92400E",
      codebench: "#57534E",
      ai: "#0F766E",
      analytics: "#D97706",
      calendar: "#A16207",
      messages: "#0D9488",
      discussion: "#14B8A6",
      reward: "#FBBF24",
      projects: "#78350F",
      practice: "#166534",
      info: "#1D4ED8",
      neutral: "#78716C",
    },
    previewSwatches: ["#166534", "#B45309", "#0D9488", "#FBBF24", "#78716C"],
  },
  {
    id: "forest-mist",
    name: "Forest Mist",
    tagline: "Organic greens with soft moss and clay accents",
    moduleHues: {
      homework: "#B45309",
      attendance: "#0EA5E9",
      quiz: "#047857",
      codebench: "#0F766E",
      ai: "#0891B2",
      analytics: "#BE123C",
      calendar: "#0284C7",
      messages: "#0D9488",
      discussion: "#14B8A6",
      reward: "#CA8A04",
      projects: "#065F46",
      practice: "#10B981",
      info: "#2563EB",
      neutral: "#64748B",
    },
    previewSwatches: ["#10B981", "#B45309", "#0D9488", "#CA8A04", "#0284C7"],
  },
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Violet + cyan dual-accent modules for creative dashboards",
    moduleHues: {
      homework: "#F97316",
      attendance: "#39D0FF",
      quiz: "#7C6CFF",
      codebench: "#6366F1",
      ai: "#22D3EE",
      analytics: "#EC4899",
      calendar: "#0EA5E9",
      messages: "#14B8A6",
      discussion: "#2DD4BF",
      reward: "#FBBF24",
      projects: "#8B5CF6",
      practice: "#34D399",
      info: "#3B82F6",
      neutral: "#64748B",
    },
    previewSwatches: ["#34D399", "#F97316", "#14B8A6", "#FBBF24", "#39D0FF"],
  },
  {
    id: "liquid-glass",
    name: "Liquid Glass",
    tagline: "Cool glass neutrals with soft lavender module tints",
    moduleHues: {
      homework: "#F59E0B",
      attendance: "#38BDF8",
      quiz: "#8B7CFF",
      codebench: "#6366F1",
      ai: "#22D3EE",
      analytics: "#F472B6",
      calendar: "#0EA5E9",
      messages: "#14B8A6",
      discussion: "#2DD4BF",
      reward: "#FBBF24",
      projects: "#7C6CFF",
      practice: "#34D399",
      info: "#3B82F6",
      neutral: "#94A3B8",
    },
    previewSwatches: ["#34D399", "#F59E0B", "#14B8A6", "#FBBF24", "#38BDF8"],
  },
  {
    id: "arctic",
    name: "Arctic",
    tagline: "Icy sky blues and crisp neutrals",
    moduleHues: {
      homework: "#F97316",
      attendance: "#0EA5E9",
      quiz: "#6366F1",
      codebench: "#0284C7",
      ai: "#22D3EE",
      analytics: "#EC4899",
      calendar: "#38BDF8",
      messages: "#0D9488",
      discussion: "#14B8A6",
      reward: "#EAB308",
      projects: "#4F46E5",
      practice: "#10B981",
      info: "#2563EB",
      neutral: "#64748B",
    },
    previewSwatches: ["#10B981", "#F97316", "#0D9488", "#EAB308", "#0EA5E9"],
  },
]

export function getSemanticPaletteDefinition(id: SemanticPaletteId): SemanticPaletteDefinition {
  return SEMANTIC_PALETTE_DEFINITIONS.find((p) => p.id === id) ?? SEMANTIC_PALETTE_DEFINITIONS[0]!
}

export function resolveModuleHuesForPalette(paletteId: SemanticPaletteId): ModuleHueMap {
  const def = getSemanticPaletteDefinition(paletteId)
  return { ...DEFAULT_MODULE_HUES, ...def.moduleHues }
}

/** Nav-group preview: brand accent + five accordion swatches */
export function getSemanticPalettePreviewColors(
  paletteId: SemanticPaletteId,
  brandAccent: string,
): string[] {
  const def = getSemanticPaletteDefinition(paletteId)
  return [brandAccent, ...def.previewSwatches]
}
