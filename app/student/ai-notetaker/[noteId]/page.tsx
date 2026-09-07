"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function StudentAiNotetakerNoteRedirectPage() {
  const params = useParams()
  const router = useRouter()
  useEffect(() => {
    const id = params?.noteId
    if (typeof id === "string") {
      router.replace(`/student/dashboard-v2/ai-notetaker/${id}`)
    }
  }, [params, router])
  return (
    <div className="flex min-h-[30vh] items-center justify-center text-sm text-slate-500">
      Opening AI Notetaker…
    </div>
  )
}
