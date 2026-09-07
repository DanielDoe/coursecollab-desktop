export type MessageDeliveryStatus = "sent" | "delivered" | "read"

export function resolveMessageDeliveryStatus(
  createdAt: string,
  otherLastReadAt: string | null | undefined,
): MessageDeliveryStatus {
  if (!otherLastReadAt) return "delivered"

  const messageTime = new Date(createdAt).getTime()
  const readTime = new Date(otherLastReadAt).getTime()
  if (Number.isFinite(messageTime) && Number.isFinite(readTime) && readTime >= messageTime) {
    return "read"
  }

  return "delivered"
}

export function deliveryStatusLabel(status: MessageDeliveryStatus): string {
  switch (status) {
    case "read":
      return "Read"
    case "delivered":
      return "Delivered"
    default:
      return "Sent"
  }
}
