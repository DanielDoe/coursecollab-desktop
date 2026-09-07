import { Briefcase, FileUp, Mail, ScanSearch, Wand2, Zap } from "lucide-react"
import type { CoraPlusMenuItem } from "@/components/cora/CoraChatInput"

/**
 * Career-member items for the Cora chat "+" menu.
 * Ids prefixed with `goto:` navigate; consumed via CoraChatInput onQuickAction.
 */
export const GUEST_CAREER_PLUS_MENU_LABEL = "Career tools"

export const GUEST_CAREER_PLUS_MENU_ITEMS: CoraPlusMenuItem[] = [
  {
    id: "goto:/guest/cora-career/match",
    label: "Résumé match",
    description: "Score your résumé against a role",
    icon: ScanSearch,
  },
  {
    id: "goto:/guest/cora-career/quick-scan",
    label: "Quick scan",
    description: "Fast fit check with your saved résumé",
    icon: Zap,
  },
  {
    id: "goto:/guest/cora-career/cover-letter",
    label: "Cover letter",
    description: "Draft from your résumé + the role",
    icon: Mail,
  },
  {
    id: "goto:/guest/cora-career/optimize",
    label: "Résumé optimize",
    description: "Fix missing keywords and gaps",
    icon: Wand2,
  },
  {
    id: "goto:/guest/cora-career/applications",
    label: "Applications",
    description: "Track and update your pipeline",
    icon: Briefcase,
  },
  {
    id: "goto:/guest/settings?section=cora",
    label: "Update master résumé",
    description: "Upload a new PDF, DOCX, or image",
    icon: FileUp,
  },
]

/** Returns the target path when the action id is a navigation item. */
export function guestPlusMenuTarget(actionId: string): string | null {
  return actionId.startsWith("goto:") ? actionId.slice(5) : null
}
