import {
  normalizeFlashcardDifficulty,
  type FlashcardDifficulty,
} from "@/lib/flashcards-types"

/**
 * Color Hunt palette — mirrors mobile `flashcard-difficulty-theme.ts`
 * https://colorhunt.co/palette/ff6a1cffda62ffae56f5788b
 */
export const FLASHCARD_DIFFICULTY_COLORS = {
  orange: "#FF6A1C",
  yellow: "#FFDA62",
  amber: "#FFAE56",
  pink: "#F5788B",
  yellowLight: "#FFE999",
  amberLight: "#FFD099",
  orangeDeep: "#E05510",
  pinkDeep: "#D86176",
  ink: "#4A2E0A",
} as const

type BadgeStyle = {
  backgroundColor: string
  color: string
  borderColor: string
}

type FaceStyle = {
  frontClass: string
  backClass: string
  frontBadgeClass: string
  backBadgeClass: string
}

const BADGE: Record<FlashcardDifficulty, BadgeStyle> = {
  easy: {
    backgroundColor: FLASHCARD_DIFFICULTY_COLORS.yellow,
    color: FLASHCARD_DIFFICULTY_COLORS.ink,
    borderColor: FLASHCARD_DIFFICULTY_COLORS.yellow,
  },
  medium: {
    backgroundColor: FLASHCARD_DIFFICULTY_COLORS.amber,
    color: FLASHCARD_DIFFICULTY_COLORS.ink,
    borderColor: FLASHCARD_DIFFICULTY_COLORS.amber,
  },
  hard: {
    backgroundColor: FLASHCARD_DIFFICULTY_COLORS.orange,
    color: "#FFFFFF",
    borderColor: FLASHCARD_DIFFICULTY_COLORS.orange,
  },
  very_hard: {
    backgroundColor: FLASHCARD_DIFFICULTY_COLORS.pink,
    color: "#FFFFFF",
    borderColor: FLASHCARD_DIFFICULTY_COLORS.pink,
  },
}

/** Tailwind-friendly face classes for study / editor flip preview. */
const FACE: Record<FlashcardDifficulty, FaceStyle> = {
  easy: {
    frontClass:
      "border-[#FFDA62] bg-gradient-to-br from-[#FFDA62] to-[#FFE999] text-[#4A2E0A] shadow-[0_18px_40px_-18px_rgba(255,218,98,0.55)]",
    backClass:
      "border-[#E6C24F] bg-gradient-to-br from-[#E6C24F] to-[#FFDA62] text-[#4A2E0A] shadow-[0_18px_40px_-18px_rgba(255,218,98,0.55)]",
    frontBadgeClass: "bg-[#4A2E0A]/10 text-[#4A2E0A]",
    backBadgeClass: "bg-[#4A2E0A]/10 text-[#4A2E0A]",
  },
  medium: {
    frontClass:
      "border-[#FFAE56] bg-gradient-to-br from-[#FFAE56] to-[#FFD099] text-[#4A2E0A] shadow-[0_18px_40px_-18px_rgba(255,174,86,0.55)]",
    backClass:
      "border-[#E89842] bg-gradient-to-br from-[#E89842] to-[#FFAE56] text-[#4A2E0A] shadow-[0_18px_40px_-18px_rgba(255,174,86,0.55)]",
    frontBadgeClass: "bg-[#4A2E0A]/10 text-[#4A2E0A]",
    backBadgeClass: "bg-[#4A2E0A]/10 text-[#4A2E0A]",
  },
  hard: {
    frontClass:
      "border-[#FF6A1C] bg-gradient-to-br from-[#FF6A1C] to-[#E05510] text-white shadow-[0_18px_40px_-18px_rgba(255,106,28,0.6)]",
    backClass:
      "border-[#E05510] bg-gradient-to-br from-[#E05510] to-[#FF6A1C] text-white shadow-[0_18px_40px_-18px_rgba(255,106,28,0.6)]",
    frontBadgeClass: "bg-white/20 text-white",
    backBadgeClass: "bg-white/20 text-white",
  },
  very_hard: {
    frontClass:
      "border-[#F5788B] bg-gradient-to-br from-[#F5788B] to-[#D86176] text-white shadow-[0_18px_40px_-18px_rgba(245,120,139,0.6)]",
    backClass:
      "border-[#D86176] bg-gradient-to-br from-[#D86176] to-[#F5788B] text-white shadow-[0_18px_40px_-18px_rgba(245,120,139,0.6)]",
    frontBadgeClass: "bg-white/20 text-white",
    backBadgeClass: "bg-white/20 text-white",
  },
}

export function flashcardDifficultyBadgeStyle(
  difficulty?: FlashcardDifficulty | string | null,
): BadgeStyle {
  return BADGE[normalizeFlashcardDifficulty(difficulty)]
}

export function flashcardDifficultyFaceStyle(
  difficulty?: FlashcardDifficulty | string | null,
): FaceStyle {
  return FACE[normalizeFlashcardDifficulty(difficulty)]
}
