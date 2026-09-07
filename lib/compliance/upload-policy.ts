export type UploadFeature =
  | "profile_image"
  | "course_document"
  | "assignment_submission"
  | "project_file"
  | "cora_attachment"

export type UploadPolicy = {
  feature: UploadFeature
  maxBytes: number
  allowedMime: readonly string[]
}

export const UPLOAD_POLICIES: Record<UploadFeature, UploadPolicy> = {
  profile_image: {
    feature: "profile_image",
    maxBytes: 5 * 1024 * 1024,
    allowedMime: ["image/jpeg", "image/png", "image/webp"],
  },
  course_document: {
    feature: "course_document",
    maxBytes: 25 * 1024 * 1024,
    allowedMime: ["application/pdf", "image/jpeg", "image/png"],
  },
  assignment_submission: {
    feature: "assignment_submission",
    maxBytes: 25 * 1024 * 1024,
    allowedMime: ["application/pdf", "image/jpeg", "image/png", "text/plain"],
  },
  project_file: {
    feature: "project_file",
    maxBytes: 40 * 1024 * 1024,
    allowedMime: ["application/pdf", "image/jpeg", "image/png", "application/zip"],
  },
  cora_attachment: {
    feature: "cora_attachment",
    maxBytes: 10 * 1024 * 1024,
    allowedMime: ["application/pdf", "image/jpeg", "image/png", "text/plain"],
  },
}

export function assertUploadAllowed(feature: UploadFeature, input: { size: number; mime: string }): string | null {
  const policy = UPLOAD_POLICIES[feature]
  if (input.size > policy.maxBytes) return "File is too large."
  if (!policy.allowedMime.includes(input.mime)) return "File type is not allowed."
  return null
}
