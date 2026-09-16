export type ParticipantKind = "student" | "instructor"

export type MessageDeliveryStatus = "sent" | "delivered" | "read"

export type MessageActor = {
  kind: ParticipantKind
  id: number
}

export type ParticipantRef = MessageActor

export type MessageRecipient = {
  kind: ParticipantKind
  id: number
  displayName: string
  email: string | null
  subtitle: string
  /** False for instructor demo accounts when the searcher is another student. */
  messageable?: boolean
}

export type ThreadSummary = {
  id: number
  subject: string | null
  updatedAt: string
  unreadCount: number
  otherParticipant: MessageRecipient
  lastMessage: {
    body: string
    createdAt: string
    senderKind: ParticipantKind
    senderId: number
    deliveryStatus?: MessageDeliveryStatus
  } | null
}

export type MessageEditVersion = {
  body: string
  editedAt: string
}

export type ThreadMessage = {
  id: number
  senderKind: ParticipantKind
  senderId: number
  senderName: string
  subject: string | null
  body: string
  createdAt: string
  isMine: boolean
  deliveryStatus?: MessageDeliveryStatus
  attachments: MessageAttachment[]
  reactions: MessageReactionGroup[]
  unsent?: boolean
  unsentAt?: string | null
  unsentByMe?: boolean
  edited?: boolean
  editedAt?: string | null
  editHistory?: MessageEditVersion[]
  canUnsend?: boolean
  canEdit?: boolean
}

export type MessageAttachment = {
  id: number
  fileName: string
  fileUrl: string
  mimeType: string | null
  fileSize: number | null
}

export type MessageReactionGroup = {
  emoji: string
  count: number
  reactedByMe: boolean
}

export type ThreadDetail = {
  id: number
  subject: string | null
  otherParticipant: MessageRecipient
  otherLastReadAt: string | null
  messages: ThreadMessage[]
}
