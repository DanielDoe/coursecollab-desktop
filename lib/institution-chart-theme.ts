/**
 * Institution portal analytics — Color Hunt chart fills.
 * Mid/deep stops from locked module palettes (see lib/student-color-hunt-theme.ts).
 */
import { COLOR_HUNT_PALETTES } from "@/lib/student-color-hunt-theme"

const P = COLOR_HUNT_PALETTES

/** Cycle for pies, horizontal bars, and legends. */
export const INSTITUTION_CHART_FILLS = [
  P.atelierNight[2], // #4E31AA
  P.atelierNight[1], // #3795BD
  P.materialGreen[2], // #66BB6A
  P.warmFlame[1], // #FB6C00
  P.violetHarbor[1], // #7965C1
  P.materialBlue[2], // #2196F3
  P.coralViolet[2], // #E22F80
  P.tealMango[2], // #44A1A4
  P.seaCoral[0], // #249D8F
  P.duskRose[3], // #FC5185
] as const

/** Semantic fills for stacked academic-activity bars. */
export const INSTITUTION_STACKED_ACTIVITY_FILLS = {
  assessments: P.atelierNight[2],
  practice: P.materialGreen[2],
  coding: P.warmFlame[1],
  coraLearning: P.violetHarbor[1],
} as const

/** Practice-band fills. Do not use a loud fill for “not attempted”. */
export const INSTITUTION_TRAJECTORY_FILLS = {
  emerging: P.warmFlame[1],
  developing: P.tealMango[2],
  proficient: P.atelierNight[1],
  mastered: P.atelierNight[2],
  attempt: P.materialGreen[2],
} as const

export const INSTITUTION_CHART_PRIMARY = P.atelierNight[2]
export const INSTITUTION_CHART_SECONDARY = P.materialGreen[2]
export const INSTITUTION_CHART_ACCENT = P.atelierNight[1]

export function institutionChartFill(index: number): string {
  const len = INSTITUTION_CHART_FILLS.length
  return INSTITUTION_CHART_FILLS[((index % len) + len) % len]!
}
