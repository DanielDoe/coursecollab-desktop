"use client"

import { AssessmentHistory } from "@/components/assessment-history"

/** Homework-only history — uses unified assessment history UI. */
export function HomeworkHistory({ embedInDashboard = false }: { embedInDashboard?: boolean }) {
  return <AssessmentHistory embedInDashboard={embedInDashboard} typeFilter="homework" />
}
