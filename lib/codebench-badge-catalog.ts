/**
 * Client-safe CodeBench badge catalog (no DB imports).
 */

export type CodebenchBadgeDef = {
  name: string
  icon: string
  description: string
  threshold: number
}

export const BADGE_DEFINITIONS = {
  loops_master: {
    name: "Mastered Loops",
    icon: "🔄",
    description: "Ship approved solutions that use for/while loops",
    threshold: 5,
  },
  bug_hunter: {
    name: "Bug Hunter",
    icon: "🐛",
    description: "Submit 10+ CodeBench solutions",
    threshold: 10,
  },
  clean_code: {
    name: "Clean Code Award",
    icon: "✨",
    description: "Earn 5+ approved submissions",
    threshold: 5,
  },
  oop_apprentice: {
    name: "OOP Apprentice",
    icon: "🏛️",
    description: "Use class or struct in approved code",
    threshold: 3,
  },
  pointer_pathfinder: {
    name: "Pointer Pathfinder",
    icon: "📍",
    description: "Demonstrate pointer or reference usage",
    threshold: 5,
  },
  recursion_king: {
    name: "Recursion King",
    icon: "♻️",
    description: "Solve problems with recursion patterns",
    threshold: 3,
  },
  stl_expert: {
    name: "STL Expert",
    icon: "📚",
    description: "Use STL containers effectively",
    threshold: 3,
  },
  arrays_ace: {
    name: "Arrays Ace",
    icon: "📦",
    description: "Work with arrays in approved submissions",
    threshold: 5,
  },
  first_blood: {
    name: "First Blood",
    icon: "⚔️",
    description: "Complete your first CodeBench submission",
    threshold: 1,
  },
  rising_coder: {
    name: "Rising Coder",
    icon: "📈",
    description: "Reach 25 total submissions",
    threshold: 25,
  },
  perfectionist: {
    name: "Perfectionist",
    icon: "🎯",
    description: "Earn a perfect 100 score on a submission",
    threshold: 1,
  },
  high_scorer: {
    name: "High Scorer",
    icon: "⭐",
    description: "Post 5 submissions scoring 90+",
    threshold: 5,
  },
  challenge_starter: {
    name: "Challenge Starter",
    icon: "🏁",
    description: "Complete your first daily challenge",
    threshold: 1,
  },
  challenge_champ: {
    name: "Challenge Champ",
    icon: "🏆",
    description: "Complete 7 daily challenges",
    threshold: 7,
  },
  practice_pro: {
    name: "Practice Pro",
    icon: "📝",
    description: "Complete 10 practice problems",
    threshold: 10,
  },
  streak_3: {
    name: "3-Day Streak",
    icon: "🔥",
    description: "Maintain a 3-day coding streak",
    threshold: 3,
  },
  streak_7: {
    name: "7-Day Streak",
    icon: "🔥🔥",
    description: "Maintain a 7-day coding streak",
    threshold: 7,
  },
  streak_14: {
    name: "14-Day Streak",
    icon: "🔥🔥",
    description: "Maintain a 14-day coding streak",
    threshold: 14,
  },
  streak_30: {
    name: "30-Day Streak",
    icon: "🔥🔥🔥",
    description: "Maintain a 30-day coding streak",
    threshold: 30,
  },
  xp_collector: {
    name: "XP Collector",
    icon: "💎",
    description: "Earn 500+ XP from CodeBench awards",
    threshold: 500,
  },
} as const satisfies Record<string, CodebenchBadgeDef>

export type CodebenchBadgeId = keyof typeof BADGE_DEFINITIONS

export function getCodebenchBadgeCatalog(): Array<{
  id: CodebenchBadgeId
  name: string
  description: string
  icon: string
}> {
  return (Object.keys(BADGE_DEFINITIONS) as CodebenchBadgeId[]).map((id) => ({
    id,
    name: BADGE_DEFINITIONS[id].name,
    description: BADGE_DEFINITIONS[id].description,
    icon: BADGE_DEFINITIONS[id].icon,
  }))
}
