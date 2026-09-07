import { getStudentData, studentApiFetch } from "@/lib/auth"

export type SubmitSupportTicketInput = {
  subject: string
  description: string
  category?: string
  priority?: string
}

export async function submitGuestSupportTicket(input: SubmitSupportTicketInput): Promise<Response> {
  const d = getStudentData()
  return studentApiFetch("/api/student/support-tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: d?.databaseId ?? null,
      subject: input.subject,
      description: input.description,
      category: input.category ?? "general",
      priority: input.priority ?? "medium",
      audience: "guest",
    }),
  })
}
