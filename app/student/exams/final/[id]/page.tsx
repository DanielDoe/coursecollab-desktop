"use client"

import { FinalExamTaker } from "@/components/final-exam-taker"
import { useParams } from "next/navigation"

export default function FinalExamPage() {
  const params = useParams()
  const examId = params.id as string

  return (
    <div className="overflow-x-hidden">
      <FinalExamTaker examId={examId} assessmentType="final" />
    </div>
  )
}

