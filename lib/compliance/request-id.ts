import { randomBytes } from "node:crypto"

export function createErrorReference(): string {
  return `ERR_${randomBytes(4).toString("hex").toUpperCase()}`
}

export function publicServerError(fallback = "Something went wrong.") {
  const reference = createErrorReference()
  return {
    reference,
    body: { error: fallback, reference },
  }
}
