export type CoraMessageMenuActionId =
  | "save-note"
  | "regenerate"
  | "explain-simpler"
  | "create-flashcards"
  | "branch-chat"
  | "double-check"
  | "report-concern"
  | "copy"

export type CoraMessageMenuItem = {
  id: CoraMessageMenuActionId
  label: string
  assistantOnly?: boolean
  lastResponseOnly?: boolean
  destructive?: boolean
}

export const CORA_MESSAGE_MENU_ITEMS: CoraMessageMenuItem[] = [
  { id: "save-note", label: "Save to My Notes", assistantOnly: true },
  { id: "regenerate", label: "Regenerate answer", assistantOnly: true, lastResponseOnly: true },
  { id: "explain-simpler", label: "Explain simpler", assistantOnly: true },
  { id: "create-flashcards", label: "Create flashcards", assistantOnly: true },
  { id: "branch-chat", label: "Branch in new chat", assistantOnly: true },
  { id: "double-check", label: "Double-check answer", assistantOnly: true },
  { id: "copy", label: "Copy text" },
  { id: "report-concern", label: "Report a concern", destructive: true },
]
