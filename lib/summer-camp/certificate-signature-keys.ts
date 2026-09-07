/** Client-safe signature asset keys — no server or DB imports. */

export function instructorSignatureFileKey(instructorId: number): string {
  return `instructor-${instructorId}`
}
