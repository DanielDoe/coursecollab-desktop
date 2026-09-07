import { sql } from "@/lib/db"
import type { TrainingCertificateFaculty } from "@/lib/summer-camp/certificate-instructor-signatory"

/** Instructors assigned to the training (excludes TAs). Server-only. */
export async function getTrainingCertificateFaculty(
  trainingId: number,
): Promise<TrainingCertificateFaculty[]> {
  const rows = await sql`
    SELECT
      i.id,
      i.name,
      i.email,
      i.job_title,
      i.institution,
      COALESCE(i.role, 'instructor') AS account_role,
      f.role AS training_role
    FROM camp_training_faculty f
    JOIN instructors i ON i.id = f.instructor_id
    WHERE f.training_id = ${trainingId}
      AND COALESCE(i.role, 'instructor') NOT IN ('ta')
    ORDER BY
      CASE WHEN f.role = 'lead' THEN 0 WHEN f.role = 'assistant' THEN 1 ELSE 2 END,
      i.name ASC
  `
  return rows as TrainingCertificateFaculty[]
}
