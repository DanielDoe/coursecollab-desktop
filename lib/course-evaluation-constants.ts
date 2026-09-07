import { ENGAGEMENT_POINTS } from "@/lib/engagement-points-system"

/** Approved course evaluation = 50% of gradebook engagement credits (100 max). Client-safe. */
export const COURSE_EVALUATION_ENGAGEMENT_CREDITS =
  ENGAGEMENT_POINTS.gradebookTotalMax * 0.5
