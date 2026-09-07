import { sql } from "@/lib/db"
import { getQuestionBankTypeMeta } from "@/lib/question-bank-type-config"
import {
  isCustomQuestionTypeId,
  mapCustomTypeRow,
  type CustomQuestionTypeDraft,
  type CustomQuestionTypeRecord,
} from "@/lib/custom-question-types"

export async function listCustomQuestionTypesForCourse(courseId: number): Promise<CustomQuestionTypeRecord[]> {
  const rows = await sql`
    SELECT
      id,
      course_id,
      type_id,
      label,
      description,
      category,
      requires_options,
      uses_code_editor,
      uses_grading_guidelines,
      schema_json,
      ai_question_prompt,
      created_at
    FROM custom_question_types
    WHERE course_id = ${courseId}
    ORDER BY label ASC
  `
  return rows.map(mapCustomTypeRow)
}

export async function getCustomQuestionTypeForCourse(
  courseId: number,
  typeId: string,
): Promise<CustomQuestionTypeRecord | null> {
  const rows = await sql`
    SELECT
      id,
      course_id,
      type_id,
      label,
      description,
      category,
      requires_options,
      uses_code_editor,
      uses_grading_guidelines,
      schema_json,
      ai_question_prompt,
      created_at
    FROM custom_question_types
    WHERE course_id = ${courseId} AND type_id = ${typeId}
    LIMIT 1
  `
  return rows[0] ? mapCustomTypeRow(rows[0]) : null
}

export async function saveCustomQuestionType(
  courseId: number,
  instructorId: number,
  draft: CustomQuestionTypeDraft,
): Promise<CustomQuestionTypeRecord> {
  if (!isCustomQuestionTypeId(draft.typeId)) {
    throw new Error("Custom type id must match custom_[a-z0-9_]+")
  }

  const rows = await sql`
    INSERT INTO custom_question_types (
      course_id,
      created_by_instructor_id,
      type_id,
      label,
      description,
      category,
      requires_options,
      uses_code_editor,
      uses_grading_guidelines,
      schema_json,
      ai_question_prompt,
      updated_at
    ) VALUES (
      ${courseId},
      ${instructorId},
      ${draft.typeId},
      ${draft.label.trim()},
      ${draft.description.trim()},
      ${draft.category},
      ${draft.requiresOptions},
      ${draft.usesCodeEditor},
      ${draft.usesGradingGuidelines},
      ${JSON.stringify(draft.schema)}::jsonb,
      ${draft.aiQuestionPrompt.trim() || null},
      NOW()
    )
    ON CONFLICT (course_id, type_id) DO UPDATE SET
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      requires_options = EXCLUDED.requires_options,
      uses_code_editor = EXCLUDED.uses_code_editor,
      uses_grading_guidelines = EXCLUDED.uses_grading_guidelines,
      schema_json = EXCLUDED.schema_json,
      ai_question_prompt = EXCLUDED.ai_question_prompt,
      updated_at = NOW()
    RETURNING
      id,
      course_id,
      type_id,
      label,
      description,
      category,
      requires_options,
      uses_code_editor,
      uses_grading_guidelines,
      schema_json,
      ai_question_prompt,
      created_at
  `
  return mapCustomTypeRow(rows[0]!)
}

export async function deleteCustomQuestionType(
  courseId: number,
  typeId: string,
): Promise<boolean> {
  if (!isCustomQuestionTypeId(typeId)) return false
  const rows = await sql`
    DELETE FROM custom_question_types
    WHERE course_id = ${courseId} AND type_id = ${typeId}
    RETURNING id
  `
  return rows.length > 0
}

export async function isAllowedQuestionTypeForCourse(courseId: number, typeId: string): Promise<boolean> {
  if (getQuestionBankTypeMeta(typeId)) return true
  if (!isCustomQuestionTypeId(typeId)) return false
  const row = await getCustomQuestionTypeForCourse(courseId, typeId)
  return !!row
}
