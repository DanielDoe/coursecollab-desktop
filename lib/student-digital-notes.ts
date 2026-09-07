import { parseCircuitWorkspace, type CircuitWorkspace } from "@/lib/circuit-workspace"

export type StudentDigitalNoteRow = {
  id: number
  title: string
  body_text: string
  ink_workspace: unknown
  icon_color?: string | null
  created_at: string
  updated_at: string
}

export type StudentDigitalNote = {
  id: number
  title: string
  bodyText: string
  inkWorkspace: CircuitWorkspace | null
  iconColor?: string | null
  createdAt: string
  updatedAt: string
  isOwner?: boolean
  ownerName?: string | null
  sharedAt?: string | null
}

export function normalizeNoteIconColor(value: unknown): string | null {
  if (typeof value !== "string") return null
  const hex = value.trim()
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : null
}

export type StudentDigitalNoteShare = {
  studentDatabaseId: number
  fullName: string
}

export function mapStudentDigitalNote(
  row: StudentDigitalNoteRow,
  extras?: {
    isOwner?: boolean
    ownerName?: string | null
    sharedAt?: string | null
  },
): StudentDigitalNote {
  return {
    id: row.id,
    title: row.title,
    bodyText: row.body_text ?? "",
    inkWorkspace: parseCircuitWorkspace(row.ink_workspace),
    iconColor: normalizeNoteIconColor(row.icon_color),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner: extras?.isOwner,
    ownerName: extras?.ownerName ?? null,
    sharedAt: extras?.sharedAt ?? null,
  }
}

export function buildDigitalNoteExportPayload(note: StudentDigitalNote) {
  return {
    version: 1 as const,
    kind: "coursecollab_digital_note" as const,
    exportedAt: new Date().toISOString(),
    note: {
      title: note.title,
      bodyText: note.bodyText,
      inkWorkspace: note.inkWorkspace,
      updatedAt: note.updatedAt,
    },
  }
}
