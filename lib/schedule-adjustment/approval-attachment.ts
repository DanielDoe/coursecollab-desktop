const PREFIX = "private/schedule-adjustments"

export function approvalFileProxyPath(requestId: number): string {
  return `/api/instructor/schedule-adjustments/${requestId}/approval-file`
}

export function approvalBlobKey(requestId: number, ext: string): string {
  const safeExt = (ext || "pdf").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "pdf"
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${PREFIX}/${requestId}/approval-${id}.${safeExt}`
}

export function isOwnedApprovalAttachment(requestId: number, value: string | null | undefined): boolean {
  if (!value) return true
  return value.startsWith(`${PREFIX}/${requestId}/`)
}

export function toClientApprovalAttachmentUrl(
  requestId: number,
  stored: string | null | undefined,
): string | null {
  if (!stored) return null
  return approvalFileProxyPath(requestId)
}
