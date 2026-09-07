import type { MembershipTier } from "@/lib/membership-constants"

const TIER_ORDER: Record<MembershipTier, number> = {
  Scholar: 0,
  Explorer: 1,
  Trailblazer: 2,
}

/** AI Notetaker is only for Explorer and Trailblazer (not Scholar). */
export function canAccessAiNotetaker(tier: MembershipTier | null): boolean {
  if (!tier) return false
  return TIER_ORDER[tier] >= TIER_ORDER.Explorer
}

export type AiNotetakerLimits = {
  /** Max length of a single recording/upload (minutes). */
  maxNoteDurationMinutes: number
  /** Total transcription minutes allowed this calendar month (all notes). */
  transcriptionMinutesMonthly: number
  maxNotesPerMonth: number
  chatEnabled: boolean
  maxChatMessagesPerMonth: number
}

const EXPLORER: AiNotetakerLimits = {
  maxNoteDurationMinutes: 60,
  transcriptionMinutesMonthly: 180,
  maxNotesPerMonth: 40,
  chatEnabled: false,
  maxChatMessagesPerMonth: 0,
}

const TRAILBLAZER: AiNotetakerLimits = {
  maxNoteDurationMinutes: 90,
  transcriptionMinutesMonthly: 600,
  maxNotesPerMonth: 200,
  chatEnabled: true,
  maxChatMessagesPerMonth: 400,
}

export function getAiNotetakerLimitsForTier(tier: MembershipTier | null): AiNotetakerLimits | null {
  if (!tier || !canAccessAiNotetaker(tier)) return null
  return tier === "Trailblazer" ? TRAILBLAZER : EXPLORER
}

/** @deprecated use getAiNotetakerLimitsForTier — kept for gradual migration */
export function getNotetakerLimitsForTier(tier: MembershipTier | null) {
  const l = getAiNotetakerLimitsForTier(tier)
  if (!l) {
    return {
      maxNoteDurationMinutes: 0,
      transcriptionMinutes: 0,
      maxNotesPerMonth: 0,
      chatEnabled: false,
      maxChatMessagesPerMonth: 0,
    }
  }
  return {
    maxNoteDurationMinutes: l.maxNoteDurationMinutes,
    transcriptionMinutes: l.transcriptionMinutesMonthly,
    maxNotesPerMonth: l.maxNotesPerMonth,
    chatEnabled: l.chatEnabled,
    maxChatMessagesPerMonth: l.maxChatMessagesPerMonth,
  }
}
