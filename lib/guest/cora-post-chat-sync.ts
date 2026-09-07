import { upsertGuestCoraProfile } from "@/lib/cora/fetch-guest-context"

export async function syncGuestMemoryAfterChat(args: {
  guestId: number
  userMessage: string
  assistantReply: string
  toolNames: string[]
}): Promise<void> {
  const preview = args.userMessage.trim().slice(0, 280)
  const replyPreview = args.assistantReply.trim().slice(0, 280)

  await upsertGuestCoraProfile(args.guestId, {
    coraNotes: {
      last_chat_at: new Date().toISOString(),
      last_user_message_preview: preview,
      last_assistant_preview: replyPreview,
      last_tools_used: args.toolNames.slice(0, 8),
    },
  })
}
