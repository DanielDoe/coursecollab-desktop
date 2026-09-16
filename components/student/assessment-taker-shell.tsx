"use client"

type Props = {
  children: React.ReactNode
}

/** Full-bleed shell for quiz/homework/exam takers — no nested container padding. */
export function AssessmentTakerShell({ children }: Props) {
  return (
    <div className="native-app-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--cc-background)]">
      {children}
    </div>
  )
}
