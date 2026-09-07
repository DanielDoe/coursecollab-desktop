import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import {
  applyPermissionGrant,
  loadUserPermissionGrantState,
} from "@/lib/permission-grants"
import type { UserKind } from "@/lib/user-directory"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const userKind = searchParams.get("userKind") as UserKind
    const id = Number(searchParams.get("id"))
    const primaryRole = searchParams.get("primaryRole") ?? ""
    const courseId = searchParams.get("courseId") ? Number(searchParams.get("courseId")) : null

    if (!userKind || !Number.isFinite(id)) {
      return NextResponse.json({ error: "userKind and id required" }, { status: 400 })
    }

    const state = await loadUserPermissionGrantState({
      userKind,
      id,
      primaryRole,
      courseId,
    })

    if (!state) {
      return NextResponse.json({
        inherited: [],
        additional: [],
        effective: [],
        courseStaffId: null,
        note: "Students do not use staff permission grants.",
      })
    }

    return NextResponse.json(state)
  } catch (error) {
    console.error("[admin/users/permission-grants GET]", error)
    return NextResponse.json({ error: "Failed to load permission grants" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const userKind = body.userKind as UserKind
    const id = Number(body.id)
    const permissionCode = String(body.permissionCode ?? "").trim()
    const enabled = Boolean(body.enabled)
    const courseId = body.courseId != null ? Number(body.courseId) : null

    if (!userKind || !Number.isFinite(id) || !permissionCode) {
      return NextResponse.json(
        { error: "userKind, id, and permissionCode required" },
        { status: 400 },
      )
    }

    const state = await applyPermissionGrant({
      userKind,
      id,
      courseId,
      permissionCode,
      enabled,
    })

    return NextResponse.json(state)
  } catch (error) {
    console.error("[admin/users/permission-grants PATCH]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save grant" },
      { status: 500 },
    )
  }
}
