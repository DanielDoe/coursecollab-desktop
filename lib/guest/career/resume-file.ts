export const GUEST_RESUME_MAX_BYTES = 12 * 1024 * 1024

export const GUEST_RESUME_ACCEPT =
  ".pdf,.doc,.docx,.rtf,.txt,.png,.jpg,.jpeg,.webp,.heic,.gif,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const NAME_OK = /\.(pdf|docx?|rtf|txt|png|jpe?g|webp|heic|gif)$/i

export function isAllowedGuestResumeFile(file: { name: string; type?: string; size?: number }): { ok: true } | { ok: false; error: string } {
  const size = Number(file.size ?? 0)
  if (size > GUEST_RESUME_MAX_BYTES) {
    return { ok: false, error: "Résumé must be 12 MB or smaller." }
  }
  const name = file.name.trim()
  const mime = (file.type || "").toLowerCase()
  const okMime =
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "text/plain" ||
    mime === "application/rtf" ||
    mime === "text/rtf" ||
    mime === "application/msword" ||
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument.word")
  if (!NAME_OK.test(name) && !okMime) {
    return { ok: false, error: "Upload a PDF, Word, image, or text résumé." }
  }
  return { ok: true }
}

export function guestResumeHashSeed(args: {
  parsedText?: string
  originalFileName?: string | null
  originalFileUrl?: string | null
  originalMime?: string | null
}): string {
  const text = String(args.parsedText ?? "").trim()
  if (text) return text
  return [args.originalMime, args.originalFileName, args.originalFileUrl].filter(Boolean).join("|") || "empty-resume"
}
