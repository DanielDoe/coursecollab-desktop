"use client"

import { createContext, useContext, ReactNode } from "react"
import { getStudentModuleTheme } from "@/lib/student-module-themes"

type AssessmentType = "quiz" | "homework" | "mid_semester" | "final"

export function resolveAssessmentTypeKey(type?: string): AssessmentType {
  if (type === "homework") return "homework"
  if (type === "mid_semester") return "mid_semester"
  if (type === "final") return "final"
  return "quiz"
}

interface AssessmentTypeContextValue {
  assessmentType: AssessmentType
  displayName: string
  pluralName: string
  icon: string
  colors: {
    primary: string
    secondary: string
    gradient: string
    iconBg: string
    cardBorder: string
    cardBg: string
    badge: string
  }
}

const AssessmentTypeContext = createContext<AssessmentTypeContextValue | undefined>(undefined)

const ASSESSMENT_MODULE: Record<AssessmentType, string> = {
  quiz: "quizzes",
  homework: "homework",
  mid_semester: "mid-semester-exams",
  final: "final-exams",
}

const ASSESSMENT_META: Record<
  AssessmentType,
  Pick<AssessmentTypeContextValue, "displayName" | "pluralName" | "icon">
> = {
  quiz: { displayName: "Quiz", pluralName: "Quizzes", icon: "📝" },
  homework: { displayName: "Homework", pluralName: "Homework Assignments", icon: "📚" },
  mid_semester: { displayName: "Mid-Semester Exam", pluralName: "Mid-Semester Exams", icon: "📊" },
  final: { displayName: "Final Exam", pluralName: "Final Exams", icon: "🎓" },
}

export function configForType(assessmentType: AssessmentType): AssessmentTypeContextValue {
  const moduleId = ASSESSMENT_MODULE[assessmentType]
  const theme = getStudentModuleTheme(moduleId)
  const meta = ASSESSMENT_META[assessmentType]
  return {
    assessmentType,
    ...meta,
    colors: {
      primary: theme.page.iconText,
      secondary: theme.page.iconText,
      gradient: theme.page.cta,
      iconBg: `${theme.page.iconBg} ${theme.page.iconText}`,
      cardBorder: theme.page.border,
      cardBg: theme.page.softBg,
      badge: theme.page.badge,
    },
  }
}

export function AssessmentTypeProvider({
  children,
  assessmentType,
}: {
  children: ReactNode
  assessmentType: AssessmentType
}) {
  return (
    <AssessmentTypeContext.Provider value={configForType(assessmentType)}>
      {children}
    </AssessmentTypeContext.Provider>
  )
}

export function useAssessmentType() {
  const context = useContext(AssessmentTypeContext)
  if (!context) {
    throw new Error("useAssessmentType must be used within AssessmentTypeProvider")
  }
  return context
}
