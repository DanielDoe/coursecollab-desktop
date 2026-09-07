import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { isCoraGithubEnabled, submitCoraGithubFix } from "@/lib/cora/github-submit-fix"

export const dynamic = "force-dynamic"

/**
 * Platform admins only. This route writes caller-supplied file contents to a
 * branch of the product repository and opens a pull request against the base
 * branch, so anyone who can reach it can put arbitrary code in front of a
 * reviewer. It previously accepted any authenticated student or instructor,
 * which let a student at any institution commit to the repo.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    if (!isCoraGithubEnabled()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "GitHub fix submission is not enabled on this server yet. Ask your admin to configure /api/cora/github/submit-fix.",
        },
        { status: 503 },
      )
    }

    const body = (await request.json()) as {
      title?: string
      description?: string
      branchName?: string
      files?: { path: string; content: string }[]
      labels?: string[]
      linkedIssue?: number
    }

    const result = await submitCoraGithubFix({
      title: String(body.title ?? "").trim(),
      description: String(body.description ?? "").trim(),
      branchName: body.branchName,
      files: Array.isArray(body.files) ? body.files : [],
      labels: body.labels,
      linkedIssue: body.linkedIssue,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    console.error("[cora/github/submit-fix]", error)
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Submit failed" },
      { status: 500 },
    )
  }
}
