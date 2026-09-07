/**
 * Permission-aware admin data accessors for Cora Admin.
 */

import { sql } from "@/lib/db"
import type { CoraSession } from "@/lib/cora/security/types"
import { authorizeCoraTool } from "@/lib/cora/security/authorize-tool"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"

function assertAdmin(session: CoraSession) {
  if (session.role !== "admin") throw new Error("Denied (role): admin only")
}

async function gate(session: CoraSession, tool: CoraAgentToolName): Promise<string | null> {
  const auth = authorizeCoraTool(session, tool)
  if (!auth.ok) return `Denied (${auth.code}): ${auth.reason}`
  assertAdmin(session)
  return null
}

export async function coraApiAdminPlatformSnapshot(session: CoraSession): Promise<string> {
  const denied = await gate(session, "get_admin_platform_snapshot")
  if (denied) return denied
  try {
    const [students] = (await sql`SELECT COUNT(*)::int AS n FROM students`) as { n: number }[]
    const [instructors] = (await sql`SELECT COUNT(*)::int AS n FROM instructors`) as { n: number }[]
    const [courses] = (await sql`SELECT COUNT(*)::int AS n FROM courses WHERE is_active = true`) as {
      n: number
    }[]
    return [
      "**Platform snapshot (Cora Admin)**",
      `- Active courses: ${courses?.n ?? "—"}`,
      `- Students: ${students?.n ?? "—"}`,
      `- Instructors: ${instructors?.n ?? "—"}`,
      "- Use Administration modules for membership ops, billing detail, and permission changes.",
    ].join("\n")
  } catch (err) {
    console.warn("[cora/admin-api] snapshot failed:", err)
    return "Platform snapshot unavailable."
  }
}

export async function coraApiAdminRevenueSummary(session: CoraSession): Promise<string> {
  const denied = await gate(session, "get_admin_revenue_summary")
  if (denied) return denied
  try {
    // Best-effort: membership / donation tables vary by deploy — degrade gracefully
    let memberships = "—"
    let donations = "—"
    try {
      const [m] = (await sql`
        SELECT COUNT(*)::int AS n FROM student_memberships WHERE status = 'active'
      `) as { n: number }[]
      memberships = String(m?.n ?? "—")
    } catch {
      /* table may not exist */
    }
    try {
      const [d] = (await sql`
        SELECT COALESCE(SUM(amount), 0)::float AS total FROM donations
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `) as { total: number }[]
      donations = `$${Number(d?.total ?? 0).toFixed(2)} (30d)`
    } catch {
      /* table may not exist */
    }
    return [
      "**Revenue / membership summary (Cora Admin)**",
      `- Active memberships on record: ${memberships}`,
      `- Donations (approx last 30 days): ${donations}`,
      "- Open Financials / Membership admin modules for audited figures.",
    ].join("\n")
  } catch (err) {
    console.warn("[cora/admin-api] revenue failed:", err)
    return "Revenue summary unavailable. Use the Financials admin module."
  }
}

export async function coraApiAdminSecurityOverview(session: CoraSession): Promise<string> {
  const denied = await gate(session, "get_admin_security_overview")
  if (denied) return denied
  try {
    const [audits] = (await sql`
      SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `) as { n: number }[]
    const [coraBlocked] = (await sql`
      SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE action LIKE 'cora.%'
        AND metadata->>'outcome' = 'blocked'
        AND created_at >= NOW() - INTERVAL '7 days'
    `) as { n: number }[]
    return [
      "**Security / governance overview (Cora Admin)**",
      `- Audit log events (7d): ${audits?.n ?? "—"}`,
      `- Cora blocked actions (7d): ${coraBlocked?.n ?? "—"}`,
      "- Cora Admin never reveals secrets, API keys, env vars, or impersonates users.",
      "- Open Security Center / System Logs for investigation workflows.",
    ].join("\n")
  } catch (err) {
    console.warn("[cora/admin-api] security failed:", err)
    return "Security overview unavailable. Use Security Center / System Logs."
  }
}

export async function coraApiAdminGovernanceHints(session: CoraSession): Promise<string> {
  const denied = await gate(session, "get_admin_governance_hints")
  if (denied) return denied
  return [
    "**AI governance checklist**",
    "- Cora Student / Faculty / Admin are separate permission scopes — never merge contexts.",
    "- Every tool call must pass authorizeCoraTool + audit logging.",
    "- Student conversations stay private unless compliance explicitly authorizes access.",
    "- Prefer Administration UI for irreversible config, feature flags, and billing changes.",
  ].join("\n")
}
