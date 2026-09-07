"use client"

type Props = {
  children: React.ReactNode
}

/** Full-bleed shell for quiz/homework/exam takers — no nested container padding. */
export function AssessmentTakerShell({ children }: Props) {
  return (
    <div className="native-app-shell min-h-[100dvh] overflow-x-hidden bg-[var(--cc-background)]">
      {children}
    </div>
  )
}
