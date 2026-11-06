import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceSectionAccess } from "@/lib/projects/project-workspace-auth"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import {
  coraActionAllowed,
  CORA_EVIDENCE_SAFETY_SYSTEM,
  resolveSectionIntegrity,
  type CoraProjectAction,
} from "@/lib/projects/project-integrity-policy"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { buildChatCompletionBody } from "@/lib/openai-gpt5-mini"
import { wrapUntrustedCoraData } from "@/lib/cora/disclosure"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    await ensureProjectWorkspaceSchema()
    const body = await request.json()
    const sectionId = Number(body.workspaceSectionId)
    const action = String(body.action || "review_draft") as CoraProjectAction
    const message = String(body.message || "").trim()
    if (!Number.isFinite(sectionId)) {
      return NextResponse.json({ error: "workspaceSectionId required" }, { status: 400 })
    }

    const access = await requireWorkspaceSectionAccess(request, sectionId)
    if (!access.ok) return access.response

    const rows = await sql`
      SELECT ws.*, w.project_id, rev.content
      FROM project_workspace_sections ws
      JOIN project_workspaces w ON w.id = ws.workspace_id
      LEFT JOIN project_section_revisions rev ON rev.id = ws.current_revision_id
      WHERE ws.id = ${sectionId}
      LIMIT 1
    `
    const section = rows[0] as Record<string, unknown>
    const projectId = Number(section.project_id)
    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    const policy = resolveSectionIntegrity(
      assignment?.integrity_settings,
      section.config as import("@/lib/projects/project-template-types").ProjectTemplateSectionConfig,
    )

    const gate = coraActionAllowed(action, policy)
    if (!gate.allowed) {
      return NextResponse.json({ error: gate.reason || "Cora not allowed" }, { status: 403 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Cora unavailable" }, { status: 503 })
    }

    const draft = wrapUntrustedCoraData(JSON.stringify(section.content ?? {}), "section_draft")
    const userPrompt = `Action: ${action}
Section: ${section.title}
Instructions: ${section.instructions || ""}
Student message: ${message || "(none)"}
Draft content: ${draft}`

    const model = resolveModelForFeature("project_cora_assist")
    const messages = [
      { role: "system" as const, content: CORA_EVIDENCE_SAFETY_SYSTEM },
      { role: "user" as const, content: userPrompt },
    ]
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildChatCompletionBody({ model, messages, max_tokens: 900 })),
    })
    if (!res.ok) {
      return NextResponse.json({ error: "Cora request failed" }, { status: 502 })
    }
    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || ""

    return NextResponse.json({ reply, action, policy: policy.cora_policy })
  } catch (error) {
    console.error("[cora section-assist]", error)
    return NextResponse.json({ error: "Cora assist failed" }, { status: 500 })
  }
}
