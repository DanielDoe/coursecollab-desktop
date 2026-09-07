/** Cora Credit Packs — one-time top-ups (purchased credits; expire after 12 months). */

export type CoraPackAudience = "student" | "instructor"

export type CoraCreditPack = {
  id: string
  audience: CoraPackAudience
  name: string
  credits: number
  priceInCents: number
  /** Marketing blurb */
  description: string
}

export const STUDENT_CORA_PACKS: CoraCreditPack[] = [
  {
    id: "student_1k",
    audience: "student",
    name: "Study Boost",
    credits: 1000,
    priceInCents: 299,
    description: "1,000 Cora Credits for a busy study week.",
  },
  {
    id: "student_3k",
    audience: "student",
    name: "Exam Boost",
    credits: 3000,
    priceInCents: 599,
    description: "3,000 Cora Credits for exam prep and walkthroughs.",
  },
  {
    id: "student_7_5k",
    audience: "student",
    name: "Power Pack",
    credits: 7500,
    priceInCents: 1199,
    description: "7,500 Cora Credits for intensive months.",
  },
]

export const INSTRUCTOR_CORA_PACKS: CoraCreditPack[] = [
  {
    id: "instructor_5k",
    audience: "instructor",
    name: "5,000 Cora Credits",
    credits: 5000,
    priceInCents: 999,
    description: "Extra capacity for midterms and content bursts.",
  },
  {
    id: "instructor_15k",
    audience: "instructor",
    name: "15,000 Cora Credits",
    credits: 15000,
    priceInCents: 2499,
    description: "Department-scale assessment generation.",
  },
  {
    id: "instructor_40k",
    audience: "instructor",
    name: "40,000 Cora Credits",
    credits: 40000,
    priceInCents: 5999,
    description: "Largest pack for heavy course authoring seasons.",
  },
]

export function getCoraPack(packId: string): CoraCreditPack | null {
  return (
    STUDENT_CORA_PACKS.find((p) => p.id === packId) ??
    INSTRUCTOR_CORA_PACKS.find((p) => p.id === packId) ??
    null
  )
}

export function listCoraPacks(audience?: CoraPackAudience): CoraCreditPack[] {
  if (audience === "student") return STUDENT_CORA_PACKS
  if (audience === "instructor") return INSTRUCTOR_CORA_PACKS
  return [...STUDENT_CORA_PACKS, ...INSTRUCTOR_CORA_PACKS]
}

/**
 * Purchased credits survive monthly included-allowance resets.
 * They remain until consumed (not destroyed on membership reset).
 */
export const PURCHASED_CORA_CREDITS_SURVIVE_MONTHLY_RESET = true
