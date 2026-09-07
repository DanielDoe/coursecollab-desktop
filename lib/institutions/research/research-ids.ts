import { createHash } from "node:crypto"

/** Stable de-identified research ID. Never use names in default research exports. */
export function researchStudentId(institutionId: number, studentId: number): string {
  const digest = createHash("sha256")
    .update(`cc-rs:${institutionId}:${studentId}`)
    .digest("hex")
    .slice(0, 16)
  return `rs_${digest}`
}
