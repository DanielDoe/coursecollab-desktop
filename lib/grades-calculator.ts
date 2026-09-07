// Client-safe grade calculation utilities
// These functions don't require database access and can be used in client components

export interface GradeWeights {
  quiz_weight: number;
  homework_weight: number;
  midterm_weight: number;
  final_weight: number;
  attendance_weight: number;
  project_weight: number;
  classroom_weight: number;
  engagement_weight: number;
}

// Calculate letter grade from percentage
export function calculateLetterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

// Calculate weighted total score
export function calculateTotalScore(
  scores: {
    quiz: number;
    homework: number;
    midterm: number;
    final: number;
    attendance: number;
    project: number;
    classroom: number;
    engagement: number;
  },
  weights: GradeWeights
): {
  total: number;
  contributions: {
    quiz: number;
    homework: number;
    midterm: number;
    final: number;
    attendance: number;
    project: number;
    classroom: number;
    engagement: number;
  };
} {
  // Convert engagement credits to score (100 credits = 100%)
  const engagementScore = Math.min((scores.engagement / 100) * 100, 100);
  
  const contributions = {
    quiz: (scores.quiz * weights.quiz_weight) / 100,
    homework: (scores.homework * weights.homework_weight) / 100,
    midterm: (scores.midterm * weights.midterm_weight) / 100,
    final: (scores.final * weights.final_weight) / 100,
    attendance: (scores.attendance * weights.attendance_weight) / 100,
    project: (scores.project * weights.project_weight) / 100,
    classroom: (scores.classroom * weights.classroom_weight) / 100,
    engagement: (engagementScore * weights.engagement_weight) / 100,
  };
  
  const total =
    contributions.quiz +
    contributions.homework +
    contributions.midterm +
    contributions.final +
    contributions.attendance +
    contributions.project +
    contributions.classroom +
    contributions.engagement;
  
  return { total: Math.round(total * 100) / 100, contributions };
}

export type ProvisionalCategoryKey =
  | "quiz"
  | "homework"
  | "midterm"
  | "final"
  | "attendance"
  | "project"
  | "classroom"
  | "engagement"

/** Weighted grade using only categories that have scores (excludes pending / future work). */
export function calculateProvisionalTotalScore(
  scores: Record<ProvisionalCategoryKey, number>,
  weights: GradeWeights,
  pendingKeys: Set<ProvisionalCategoryKey> = new Set(),
): {
  total: number
  contributions: Record<ProvisionalCategoryKey, number>
  includedWeight: number
  pendingCategories: string[]
} {
  const labels: Record<ProvisionalCategoryKey, string> = {
    quiz: "Quizzes",
    homework: "Homework",
    midterm: "Midterm",
    final: "Final",
    attendance: "Attendance",
    project: "Projects",
    classroom: "Classroom",
    engagement: "Engagement",
  }

  const entries: Array<{ key: ProvisionalCategoryKey; score: number; weight: number }> = []
  const pendingCategories: string[] = []

  const push = (key: ProvisionalCategoryKey, score: number, weight: number) => {
    if (weight <= 0) return
    if (pendingKeys.has(key)) {
      pendingCategories.push(labels[key])
      return
    }
    entries.push({ key, score: key === "engagement" ? Math.min(100, score) : score, weight })
  }

  push("quiz", scores.quiz, weights.quiz_weight)
  push("homework", scores.homework, weights.homework_weight)
  push("midterm", scores.midterm, weights.midterm_weight)
  push("final", scores.final, weights.final_weight)
  push("attendance", scores.attendance, weights.attendance_weight)
  push("project", scores.project, weights.project_weight)
  push("classroom", scores.classroom, weights.classroom_weight)
  push("engagement", scores.engagement, weights.engagement_weight)

  const includedWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  const contributions = {
    quiz: 0,
    homework: 0,
    midterm: 0,
    final: 0,
    attendance: 0,
    project: 0,
    classroom: 0,
    engagement: 0,
  }

  if (includedWeight <= 0) {
    return { total: 0, contributions, includedWeight: 0, pendingCategories }
  }

  const weightedSum = entries.reduce((sum, e) => sum + e.score * e.weight, 0)
  for (const e of entries) {
    contributions[e.key] = Math.round(((e.score * e.weight) / includedWeight) * 100) / 100
  }

  return {
    total: Math.round((weightedSum / includedWeight) * 100) / 100,
    contributions,
    includedWeight,
    pendingCategories,
  }
}


