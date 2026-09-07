import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  deleteFacultyCoraThread,
  setActiveFacultyCoraThread,
  upsertFacultyCoraThread,
  type FacultyCoraChatThread,
} from "@/lib/cora/faculty-cora-threads"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ threadId: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const { threadId } = await params

    const raw = await request.text()
    if (!raw.trim()) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 })
    }
    let body: { thread?: FacultyCoraChatThread; setActive?: boolean }
    try {
      body = JSON.parse(raw) as { thread?: FacultyCoraChatThread; setActive?: boolean }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!body.thread?.id || body.thread.id !== threadId) {
      return NextResponse.json({ error: "thread.id must match URL" }, { status: 400 })
    }
    if (!Array.isArray(body.thread.messages)) {
      return NextResponse.json({ error: "thread.messages required" }, { status: 400 })
    }

    const thread = await upsertFacultyCoraThread({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      thread: body.thread,
      setActive: body.setActive !== false,
    })

    return NextResponse.json({ thread, activeThreadId: thread.id })
  } catch (error) {
    console.error("[instructor/cora/threads PUT]", error)
    return NextResponse.json({ error: "Failed to save thread" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const { threadId } = await params

    await deleteFacultyCoraThread({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      threadId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[instructor/cora/threads DELETE]", error)
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const { threadId } = await params
    const body = (await request.json().catch(() => ({}))) as { setActive?: boolean }

    if (body.setActive) {
      await setActiveFacultyCoraThread({
        instructorId: scope.instructorId,
        courseId: scope.course.id,
        threadId,
      })
    }
    return NextResponse.json({ ok: true, activeThreadId: threadId })
  } catch (error) {
    console.error("[instructor/cora/threads PATCH]", error)
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 })
  }
}
