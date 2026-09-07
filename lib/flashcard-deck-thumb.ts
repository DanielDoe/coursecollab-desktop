/**
 * Flashcard deck list thumbs — appearance-accent scheme via flashcard-list-theme.
 */

import type { FlashcardDeckCardKind } from "@/lib/flashcard-deck-kind"
import {
  flashcardListIdentityThumb,
  flashcardListThumbAt,
  type FlashcardChrome,
  type SolidListThumb,
  FLASHCARD_LIST_ROLES,
} from "@/lib/flashcard-list-theme"
import { solidListThumb } from "@/lib/student-color-hunt-theme"

export function flashcardDeckSolidThumb(
  deckId: number | string,
  kind: FlashcardDeckCardKind,
  options?: { locked?: boolean; index?: number },
  chrome?: Pick<FlashcardChrome, "thumbs" | "roles">,
): SolidListThumb {
  if (options?.index != null) {
    return flashcardListIdentityThumb(options.index, kind, { locked: options.locked }, chrome)
  }
  const roles = chrome?.roles ?? FLASHCARD_LIST_ROLES
  if (options?.locked) return roles.locked
  if (kind === "empty") return roles.empty
  if (kind === "completed") return roles.completed
  const numeric = typeof deckId === "number" ? deckId : Number(deckId)
  if (Number.isFinite(numeric) && numeric > 0) {
    return flashcardListThumbAt(numeric - 1, chrome?.thumbs)
  }
  if (options?.locked) return roles.locked
  return solidListThumbFromHash(deckId, { locked: options?.locked }, chrome)
}

function solidListThumbFromHash(
  key: string | number,
  options?: { locked?: boolean },
  chrome?: Pick<FlashcardChrome, "thumbs" | "roles">,
): SolidListThumb {
  const roles = chrome?.roles ?? FLASHCARD_LIST_ROLES
  if (options?.locked) return roles.locked
  const raw = String(key)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0
  }
  if (chrome?.thumbs?.length) return flashcardListThumbAt(hash, chrome.thumbs)
  return solidListThumb(hash)
}

/** @deprecated Prefer chrome.roles via useFlashcardChrome() */
export const SOLID_THUMB_LOCKED: SolidListThumb = FLASHCARD_LIST_ROLES.locked
/** @deprecated Prefer chrome.roles via useFlashcardChrome() */
export const SOLID_THUMB_EMPTY: SolidListThumb = FLASHCARD_LIST_ROLES.empty
/** @deprecated Prefer chrome.roles via useFlashcardChrome() */
export const SOLID_THUMB_SUCCESS: SolidListThumb = FLASHCARD_LIST_ROLES.completed

export { solidListThumbFromHash }
