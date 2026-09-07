"use client"

import { studentApiFetch } from "@/lib/auth"
import { instructorApiFetch } from "@/lib/instructor-api-headers"

type CoraRole = "student" | "instructor" | "admin"

function roleHeaders(role: CoraRole, userId: number | string): HeadersInit {
  if (role === "admin") return { "x-admin-id": String(userId) }
  if (role === "instructor") return { "x-instructor-id": String(userId) }
  return { "x-student-id": String(userId) }
}

function apiFetch(role: CoraRole, input: string, init?: RequestInit): Promise<Response> {
  if (role === "instructor") return instructorApiFetch(input, init)
  if (role === "student") return studentApiFetch(input, init)
  return studentApiFetch(input, init)
}

/** Same-origin Cora ledger reads — always send desktop refresh + cookies. */
export async function fetchCoraCreditsBalance(
  role: CoraRole,
  userId: number | string,
): Promise<Response> {
  return apiFetch(role, `/api/cora/credits/balance?role=${role === "admin" ? "admin" : role}`, {
    headers: roleHeaders(role, userId),
    cache: "no-store",
  })
}

export async function fetchCoraUsageActivity(
  role: Exclude<CoraRole, "admin">,
  userId: number | string,
  params: URLSearchParams,
): Promise<Response> {
  return apiFetch(role, `/api/cora/usage/activity?${params}`, {
    headers: roleHeaders(role, userId),
    cache: "no-store",
  })
}
