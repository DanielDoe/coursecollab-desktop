/**
 * Synthetic assignment IDs for Canvas export columns that are not `quizzes` rows.
 * Negative IDs avoid collision with real quiz PKs.
 */
export const CANVAS_EXTRA_EXPORT_PROJECT_ID = -1001
export const CANVAS_EXTRA_EXPORT_CLASSROOM_ID = -1002
export const CANVAS_EXTRA_EXPORT_ATTENDANCE_ID = -1003
export const CANVAS_EXTRA_EXPORT_ENGAGEMENT_ID = -1004

export type CanvasExtraExportKey = "project" | "classroom" | "attendance" | "engagement"

export const CANVAS_EXTRA_EXPORT_COLUMNS: { id: number; title: string; key: CanvasExtraExportKey }[] = [
  { id: CANVAS_EXTRA_EXPORT_PROJECT_ID, title: "Project points (%)", key: "project" },
  {
    id: CANVAS_EXTRA_EXPORT_CLASSROOM_ID,
    title: "Classroom 10-pt category (%)",
    key: "classroom",
  },
  { id: CANVAS_EXTRA_EXPORT_ATTENDANCE_ID, title: "Attendance (%)", key: "attendance" },
  { id: CANVAS_EXTRA_EXPORT_ENGAGEMENT_ID, title: "Engagement (%)", key: "engagement" },
]

const ID_TO_KEY = new Map<number, CanvasExtraExportKey>(
  CANVAS_EXTRA_EXPORT_COLUMNS.map((c) => [c.id, c.key]),
)

export function isCanvasExtraExportId(id: number): boolean {
  return ID_TO_KEY.has(id)
}

export function canvasExtraExportIdToKey(id: number): CanvasExtraExportKey | null {
  return ID_TO_KEY.get(id) ?? null
}
