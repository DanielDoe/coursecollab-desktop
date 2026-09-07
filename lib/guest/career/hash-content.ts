import { createHash } from "node:crypto"

export function hashCareerContent(text: string): string {
  return createHash("sha256").update(text.trim().normalize("NFKC")).digest("hex").slice(0, 32)
}
