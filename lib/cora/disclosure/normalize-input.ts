/**
 * Decode common obfuscation before intent classification.
 * Does not treat decoded text as trusted instructions.
 */

const BASE64_TOKEN = /^(?:[A-Za-z0-9+/]{16,}={0,2})$/
const BASE64_CHUNK = /[A-Za-z0-9+/]{24,}={0,2}/g

function looksInstructional(text: string): boolean {
  return /\b(ignore|system prompt|hidden|instruction|vulnerability|endpoint|api key|secret|admin|tool|bypass|schema|password)\b/i.test(
    text,
  )
}

function tryDecodeBase64(raw: string): string | null {
  const trimmed = raw.trim()
  if (!BASE64_TOKEN.test(trimmed) && !/^[A-Za-z0-9+/]+=*$/.test(trimmed.replace(/\s+/g, ""))) {
    return null
  }
  try {
    const decoded = Buffer.from(trimmed.replace(/\s+/g, ""), "base64").toString("utf8")
    if (!decoded || decoded.includes("\u0000")) return null
    if (!/^[\x09\x0a\x0d\x20-\x7e\u00a0-\u024f]+$/.test(decoded)) return null
    if (decoded.length < 8) return null
    return decoded
  } catch {
    return null
  }
}

function decodeEmbeddedBase64(text: string): { text: string; decoded: boolean } {
  let decoded = false
  const next = text.replace(BASE64_CHUNK, (chunk) => {
    const inner = tryDecodeBase64(chunk)
    if (inner && looksInstructional(inner)) {
      decoded = true
      return ` ${inner} `
    }
    return chunk
  })
  return { text: next, decoded }
}

function tryUriDecode(text: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(text)) return text
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Light leetspeak / homoglyph fold for classification only. */
function foldObfuscation(text: string): string {
  return text
    .replace(/[0]/g, "o")
    .replace(/[1]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[@]/g, "a")
    .replace(/\$/g, "s")
}

export type NormalizedCoraInput = {
  original: string
  normalized: string
  obfuscationDecoded: boolean
}

export function normalizeCoraSecurityInput(message: string): NormalizedCoraInput {
  const original = String(message ?? "")
  let text = tryUriDecode(original)
  let obfuscationDecoded = text !== original

  const whole = tryDecodeBase64(text.trim())
  if (whole && looksInstructional(whole)) {
    text = `${text}\n${whole}`
    obfuscationDecoded = true
  }

  const embedded = decodeEmbeddedBase64(text)
  text = embedded.text
  obfuscationDecoded = obfuscationDecoded || embedded.decoded

  const folded = foldObfuscation(text)
  return {
    original,
    normalized: `${text}\n${folded}`.replace(/\s+/g, " ").trim(),
    obfuscationDecoded,
  }
}

export function conversationTextForClassification(
  history?: Array<{ role?: string; content?: string }>,
): string {
  if (!history?.length) return ""
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .slice(-8)
    .map((m) => String(m.content ?? ""))
    .join("\n")
}
