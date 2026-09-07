import { type NextRequest, NextResponse } from "next/server"
import { saveQuestionMediaFile } from "@/lib/question-media-storage"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function instructorId(request: NextRequest): number | null {
  const h = request.headers.get("x-instructor-id")
  if (!h) return null
  const n = Number(h)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function POST(request: NextRequest) {
  try {
    const iid = instructorId(request)
    if (iid == null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const saved = await saveQuestionMediaFile(iid, file as File)
    return NextResponse.json(saved)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed"
    const status =
      message === "file required" ||
      message.startsWith("File must be") ||
      message.startsWith("Allowed types")
        ? 400
        : 500
    if (status === 500) console.error("[question-media upload]", e)
    return NextResponse.json({ error: message }, { status })
  }
}
