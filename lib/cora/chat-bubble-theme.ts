/** Mobile-parity Cora chat bubble palette for web. */

export type CoraChatBubbleColorSet = {
  background: string
  border: string
  text: string
}

export type CoraChatBubblePalette = {
  user: CoraChatBubbleColorSet
  assistant: CoraChatBubbleColorSet
  userRadius: string
  assistantRadius: string
}

export const CORA_CHAT_PALETTE_LIGHT: CoraChatBubblePalette = {
  user: {
    background: "#f0f4f9",
    border: "transparent",
    text: "#111827",
  },
  assistant: {
    background: "transparent",
    border: "transparent",
    text: "#1f2937",
  },
  userRadius: "24px",
  assistantRadius: "0px",
}

export const CORA_CHAT_PALETTE_DARK: CoraChatBubblePalette = {
  user: {
    background: "rgba(255,255,255,0.07)",
    border: "transparent",
    text: "#f3f4f6",
  },
  assistant: {
    background: "transparent",
    border: "transparent",
    text: "#f3f4f6",
  },
  userRadius: "24px",
  assistantRadius: "0px",
}
