"use client"

import { messageBackgroundPreset, type MessageThreadBackground } from "@/lib/direct-messages/message-thread-background"

export function MessageThreadBackdrop({ background }: { background: MessageThreadBackground }) {
  if (background.kind === "image") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${background.uri})` }}
      />
    )
  }

  if (background.kind === "preset") {
    const preset = messageBackgroundPreset(background.presetId)
    if (!preset) return null
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 dark:hidden" style={{ background: preset.light }} />
        <div className="absolute inset-0 hidden dark:block" style={{ background: preset.dark }} />
      </div>
    )
  }

  return null
}
