"use client"

import { StudentNotesHub } from "@/components/student/digital-notes/student-notes-hub"

type Props = {
  nativeLayout?: boolean
  initialNoteId?: number | null
}

export function StudentNotesUnifiedPage(props: Props) {
  return <StudentNotesHub {...props} />
}

/** @deprecated Use StudentNotesUnifiedPage */
export const StudentNotesNativePage = StudentNotesUnifiedPage
