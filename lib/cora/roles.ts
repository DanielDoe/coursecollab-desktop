/**
 * Cora product identities — RBAC-scoped agents (never elevated beyond the invoker).
 *
 * - Cora Student  (agentRole: assistant)
 * - Cora Faculty  (agentRole: copilot)
 * - Cora Admin    (agentRole: admin)
 */

export type CoraAgentRole = "assistant" | "copilot" | "admin"

export const CORA_ROLE_META: Record<
  CoraAgentRole,
  { productName: string; audience: string; shortLabel: string; principal: "student" | "faculty" | "admin" }
> = {
  assistant: {
    productName: "Cora Student",
    audience: "students",
    shortLabel: "Student",
    principal: "student",
  },
  copilot: {
    productName: "Cora Faculty",
    audience: "faculty / instructors",
    shortLabel: "Faculty",
    principal: "faculty",
  },
  admin: {
    productName: "Cora Admin",
    audience: "platform administrators",
    shortLabel: "Admin",
    principal: "admin",
  },
}

export function coraProductName(role: CoraAgentRole): string {
  return CORA_ROLE_META[role].productName
}
