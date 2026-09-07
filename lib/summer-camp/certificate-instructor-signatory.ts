import type { CampCertificateSignatory, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"

export type TrainingCertificateFaculty = {
  id: number
  name: string
  email: string | null
  job_title: string | null
  institution: string | null
  account_role: string | null
  training_role: string
}

export const TRAINING_DEAN_SIGNATORY_ID = "sig-1"
export const TRAINING_INSTRUCTOR_SIGNATORY_ID = "sig-2"

export function formatCertificateSignatoryName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""
  if (/^(dr\.?|prof\.?)\s/i.test(trimmed)) return trimmed
  return trimmed
}

/** Split job_title into certificate title + department lines. */
export function parseInstructorSignatoryFields(faculty: TrainingCertificateFaculty): {
  name: string
  title: string
  department: string
  organization: string
} {
  const name = formatCertificateSignatoryName(faculty.name)
  const organization = faculty.institution?.trim() || "Prairie View A&M University"
  const job = (faculty.job_title ?? "").trim()

  if (!job) {
    return {
      name,
      title: trainingRoleLabel(faculty.training_role),
      department: "Electrical & Computer Engineering",
      organization,
    }
  }

  const comma = job.indexOf(",")
  if (comma > 0) {
    const title = job.slice(0, comma).trim()
    let department = job.slice(comma + 1).trim()
    if (/^college of engineering$/i.test(department)) {
      department = "Electrical & Computer Engineering"
    }
    department = department.split("·")[0]?.trim() ?? department
    return { name, title, department, organization }
  }

  const ece = job.match(/(Electrical\s*(?:&|and)\s*Computer Engineering)/i)
  if (ece) {
    const title = job.replace(ece[0], "").replace(/[·,]\s*$/, "").trim() || job
    return { name, title, department: ece[1], organization }
  }

  return { name, title: job, department: "", organization }
}

function trainingRoleLabel(role: string): string {
  if (role === "lead") return "Lead Instructor"
  if (role === "assistant") return "Co-Instructor"
  return "Instructor"
}

export function signatoryFromTrainingInstructor(
  faculty: TrainingCertificateFaculty,
  existing?: CampCertificateSignatory,
): CampCertificateSignatory {
  const fields = parseInstructorSignatoryFields(faculty)
  return {
    id: existing?.id ?? TRAINING_INSTRUCTOR_SIGNATORY_ID,
    ...fields,
    instructorId: faculty.id,
    signatureImageUrl: existing?.signatureImageUrl ?? null,
    enabled: existing?.enabled ?? true,
  }
}

export function pickDefaultTrainingInstructor(
  faculty: TrainingCertificateFaculty[],
): TrainingCertificateFaculty | null {
  if (faculty.length === 0) return null
  return faculty.find((f) => f.training_role === "lead") ?? faculty[0]
}

function isDeanFaculty(faculty: TrainingCertificateFaculty): boolean {
  return /dean/i.test(faculty.job_title ?? "") || /\bdean\b/i.test(faculty.name)
}

export function pickDeanFaculty(
  faculty: TrainingCertificateFaculty[],
): TrainingCertificateFaculty | null {
  return faculty.find(isDeanFaculty) ?? null
}

export function pickWorkshopInstructorFaculty(
  faculty: TrainingCertificateFaculty[],
  dean: TrainingCertificateFaculty | null,
): TrainingCertificateFaculty | null {
  const pool = dean ? faculty.filter((f) => f.id !== dean.id && !isDeanFaculty(f)) : faculty.filter((f) => !isDeanFaculty(f))
  if (pool.length === 0) return null
  return (
    pool.find((f) => f.training_role === "lead") ??
    pool.find((f) => f.training_role === "assistant") ??
    pool[0]
  )
}

function isLegacyDepartmentHeadSignatory(sig: CampCertificateSignatory): boolean {
  if (/anthony\s*hill/i.test(sig.name)) return true
  if (/department\s*head/i.test(sig.title) && sig.instructorId == null) return true
  return false
}

function isLegacyTrainingInstructorPlaceholder(sig: CampCertificateSignatory): boolean {
  if (/ifeoma\s*san/i.test(sig.name)) return true
  if (/credit\s*center\s*director/i.test(sig.title)) return true
  if (!sig.instructorId && !sig.name.trim()) return true
  return false
}

function applySignatoryFromFaculty(
  template: CampCertificateTemplate,
  signatoryId: string,
  faculty: TrainingCertificateFaculty[],
  selected: TrainingCertificateFaculty | null,
  shouldReplace: (sig: CampCertificateSignatory) => boolean,
): CampCertificateTemplate {
  if (!selected) return template

  const idx = template.signatories.findIndex((s) => s.id === signatoryId)
  if (idx < 0) return template

  const current = template.signatories[idx]
  const linked =
    current.instructorId != null ? faculty.find((f) => f.id === current.instructorId) ?? null : null
  const resolved = linked ?? (shouldReplace(current) ? selected : null)
  if (!resolved) return template

  const signatories = [...template.signatories]
  signatories[idx] = signatoryFromTrainingInstructor(resolved, { ...current, id: signatoryId })
  return { ...template, signatories }
}

/** Foundational AI Workshop: Dean on sig-1, lead/co-instructor on sig-2. */
export function applyAiBootcampSignatoriesToTemplate(
  template: CampCertificateTemplate,
  faculty: TrainingCertificateFaculty[],
): CampCertificateTemplate {
  if (faculty.length === 0) return template

  const dean = pickDeanFaculty(faculty)
  const instructor = pickWorkshopInstructorFaculty(faculty, dean)

  let next = applySignatoryFromFaculty(
    template,
    TRAINING_DEAN_SIGNATORY_ID,
    faculty,
    dean,
    (sig) => isLegacyDepartmentHeadSignatory(sig) || !sig.name.trim() || sig.instructorId == null,
  )
  next = applySignatoryFromFaculty(
    next,
    TRAINING_INSTRUCTOR_SIGNATORY_ID,
    faculty,
    instructor,
    isLegacyTrainingInstructorPlaceholder,
  )
  return next
}

/** Apply training instructor profile to sig-2 when linked or still on legacy defaults. */
export function applyTrainingInstructorToTemplate(
  template: CampCertificateTemplate,
  faculty: TrainingCertificateFaculty[],
): CampCertificateTemplate {
  if (faculty.length === 0) return template

  const idx = template.signatories.findIndex((s) => s.id === TRAINING_INSTRUCTOR_SIGNATORY_ID)
  if (idx < 0) return template

  const current = template.signatories[idx]
  let selected =
    current.instructorId != null
      ? faculty.find((f) => f.id === current.instructorId)
      : null

  if (!selected && isLegacyTrainingInstructorPlaceholder(current)) {
    selected = pickDefaultTrainingInstructor(faculty)
  }

  if (!selected) return template

  const signatories = [...template.signatories]
  signatories[idx] = signatoryFromTrainingInstructor(selected, current)
  return { ...template, signatories }
}

export function trainingFacultyOptionLabel(f: TrainingCertificateFaculty): string {
  const role =
    f.training_role === "lead"
      ? "Lead instructor"
      : f.training_role === "assistant"
        ? "Co-instructor"
        : "Instructor"
  const title = f.job_title?.trim()
  return title ? `${f.name} — ${role} · ${title}` : `${f.name} — ${role}`
}
