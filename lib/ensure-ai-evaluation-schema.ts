import type { NeonQueryFunction } from "@neondatabase/serverless"

let schemaEnsured = false

/**
 * Ensure the AI evaluation queue schema (table + supporting columns/indexes) exists.
 */
export async function ensureAiEvaluationSchema(sql: NeonQueryFunction<any, any>) {
  if (schemaEnsured) {
    return
  }

  await sql`
    CREATE TABLE IF NOT EXISTS ai_evaluation_queue (
      id SERIAL PRIMARY KEY,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      question_type VARCHAR(50) NOT NULL,
      assessment_type VARCHAR(30),
      question_text TEXT NOT NULL,
      student_answer TEXT NOT NULL,
      correct_answer TEXT,
      rubric TEXT,
      max_points INTEGER DEFAULT 100,
      error_type VARCHAR(50),
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      last_retry_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      resolved_at TIMESTAMP WITH TIME ZONE,
      resolved_by INTEGER,
      last_retried_at TIMESTAMP WITH TIME ZONE,
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
    )
  `

  await sql`
    ALTER TABLE ai_evaluation_queue
    ALTER COLUMN student_id TYPE INTEGER USING student_id::integer
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_eval_queue_status ON ai_evaluation_queue(status)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_eval_queue_attempt ON ai_evaluation_queue(attempt_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_eval_queue_student ON ai_evaluation_queue(student_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ai_eval_queue_created ON ai_evaluation_queue(created_at)
  `

  await sql`
    ALTER TABLE quiz_answers
    ADD COLUMN IF NOT EXISTS ai_retry_needed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ai_error_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS ai_last_error TEXT
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_quiz_answers_ai_retry
    ON quiz_answers(ai_retry_needed)
    WHERE ai_retry_needed = TRUE
  `

  await sql`
    ALTER TABLE ai_evaluation_queue
    ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(30)
  `

  schemaEnsured = true
}
