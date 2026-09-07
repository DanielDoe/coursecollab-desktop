type ExpoPushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: "default" | null
  badge?: number
  categoryId?: string
  channelId?: string
  priority?: "default" | "normal" | "high"
}

type ExpoPushTicket = {
  status: "ok" | "error"
  id?: string
  message?: string
  details?: { error?: string }
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return

  for (const batch of chunk(messages, 100)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      })

      if (!response.ok) {
        console.warn("[expo-push] HTTP", response.status, await response.text())
        continue
      }

      const tickets = (await response.json()) as { data?: ExpoPushTicket[] }
      for (const ticket of tickets.data ?? []) {
        if (ticket.status === "error") {
          console.warn("[expo-push] ticket error:", ticket.message, ticket.details?.error)
        }
      }
    } catch (error) {
      console.warn("[expo-push] send failed:", error)
    }
  }
}

export type { ExpoPushMessage }
