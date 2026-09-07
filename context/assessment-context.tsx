"use client"

import { createContext, useContext, type ReactNode } from "react"

export type AssessmentType = "quiz" | "mid_semester" | "final" | "homework" | "practice" | "playground"

interface AssessmentContextType {
  type: AssessmentType
  label: string
  pluralLabel: string
  colorTheme?: string
  icon?: string
}

const labelMap: Record<AssessmentType, { label: string; pluralLabel: string; colorTheme: string; icon: string }> = {
  quiz: { label: "Quiz", pluralLabel: "Quizzes", colorTheme: "emerald", icon: "📋" },
  mid_semester: { label: "Mid-Semester Exam", pluralLabel: "Mid-Semester Exams", colorTheme: "rose", icon: "🧾" },
  final: { label: "Final Exam", pluralLabel: "Final Exams", colorTheme: "slate", icon: "🎓" },
  homework: { label: "Homework Assignment", pluralLabel: "Homework Assignments", colorTheme: "amber", icon: "🏠" },
  practice: { label: "Practice Hub", pluralLabel: "Practice Sessions", colorTheme: "sky", icon: "🧠" },
  playground: { label: "Playground", pluralLabel: "Playground Sessions", colorTheme: "purple", icon: "🧩" },
}

export const AssessmentContext = createContext<AssessmentContextType>({
  type: "quiz",
  label: "Quiz",
  pluralLabel: "Quizzes",
  colorTheme: "emerald",
  icon: "📋",
})

export const useAssessment = () => useContext(AssessmentContext)

export function AssessmentProvider({
  children,
  type,
}: {
  children: ReactNode
  type: AssessmentType
}) {
  const labels = labelMap[type] || labelMap.quiz

  return (
    <AssessmentContext.Provider
      value={{
        type,
        label: labels.label,
        pluralLabel: labels.pluralLabel,
        colorTheme: labels.colorTheme,
        icon: labels.icon,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  )
}
