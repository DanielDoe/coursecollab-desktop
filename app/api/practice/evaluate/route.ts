import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import type { MembershipTier } from "@/lib/membership-constants"
import {
  isPracticeQuestionLocked,
  practiceAccessLevelForTier,
} from "@/lib/practice-tier-access"

import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { savePracticeAnswerRecord } from "@/lib/save-practice-answer"
import { evaluatePracticeUploadQuestion } from "@/lib/practice-upload-evaluate"
import { practiceAnswerReviewForEvaluateResponse } from "@/lib/practice-answer-review"
import { formatQuestionBankRowForRenderer, bankFormattedRowToVerifyPayload } from "@/lib/resolve-quiz-question-from-bank"
import {
  loadPracticeEvaluateContext,
  practiceAttemptLimitExceeded,
  resolveServerPracticeXp,
  shouldShowPracticeAnswerReview,
} from "@/lib/practice-evaluate-context"
import type { PracticeHubPolicy } from "@/lib/practice-hub-policy-settings"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"
import { recordPracticeAnswerSideEffects } from "@/lib/practice-topic-progress"

type PracticeAnswerSideEffects = Awaited<ReturnType<typeof recordPracticeAnswerSideEffects>>

function attachAttemptProgress(
  payload: Record<string, unknown>,
  sideEffects: PracticeAnswerSideEffects | null,
) {
  if (!sideEffects) return payload
  return {
    ...payload,
    attemptProgress: sideEffects.progress,
    attemptFinalized: sideEffects.finalized,
    ...(sideEffects.finalized
      ? { finalScore: sideEffects.score, finalCorrectCount: sideEffects.correctCount }
      : {}),
  }
}

async function savePracticeAnswerWithSideEffects(opts: {
  attemptId: number
  questionId: number | string
  answer: unknown
  isCorrect: boolean
  responseTimeMs?: number | null
  xpEarned?: number | null
  difficulty?: string | null
  studentDbId: number
  topic: string
}): Promise<PracticeAnswerSideEffects | null> {
  await savePracticeAnswerRecord({
    attemptId: opts.attemptId,
    questionId: opts.questionId,
    answer: opts.answer,
    isCorrect: opts.isCorrect,
    responseTimeMs: opts.responseTimeMs ?? null,
    xpEarned: opts.xpEarned ?? null,
    difficulty: opts.difficulty ?? null,
  })
  try {
    return await recordPracticeAnswerSideEffects({
      attemptId: opts.attemptId,
      studentDbId: opts.studentDbId,
      topic: opts.topic,
      isCorrect: opts.isCorrect,
    })
  } catch (error) {
    console.error("[Practice Evaluation] Progress side effects failed:", error)
    return null
  }
}


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

function withPracticeAnswerReview(
  question: Record<string, unknown>,
  answer: string | string[],
  isCorrect: boolean,
  payload: Record<string, unknown>,
  policy: PracticeHubPolicy | null,
  correctLetters?: string[],
  correctTexts?: string[],
  questionId?: number | string,
) {
  const formatted = formatQuestionBankRowForRenderer({
    ...question,
    id: question.id ?? questionId,
  })
  const showReview = policy ? shouldShowPracticeAnswerReview(policy, isCorrect) : true
  const score = typeof payload.score === "number" ? payload.score : undefined
  const pointsEarned = typeof payload.pointsEarned === "number" ? payload.pointsEarned : undefined
  const maxPoints = typeof payload.maxPoints === "number" ? payload.maxPoints : undefined
  const answerReview =
    showReview && formatted
      ? practiceAnswerReviewForEvaluateResponse({
          question: { ...formatted, question_type: String(formatted.question_type ?? "") },
          studentAnswer: answer,
          isCorrect,
          correctLetters,
          correctTexts,
          score,
          pointsEarned,
          maxPoints,
        })
      : null
  return { ...payload, answerReview, correctLetters: answerReview?.correctLetters, correctTexts: answerReview?.correctTexts }
}

export async function POST(request: NextRequest) {
  try {
    const { questionId, answer, questionType, attemptId, responseTimeMs, xpEarned, difficulty } = await request.json()

    if (!questionId || answer === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const ownedAttemptId = Number(attemptId)
    if (!Number.isFinite(ownedAttemptId) || ownedAttemptId <= 0) {
      return NextResponse.json({ error: "Practice attempt is required" }, { status: 400 })
    }
    const auth = await requirePracticeAttemptOwnership(request, ownedAttemptId)
    if (!auth.ok) return auth.response
    
    console.log("[Practice Evaluation] Received data:", { questionId, attemptId, responseTimeMs, xpEarned, difficulty })

    const evalCtx = await loadPracticeEvaluateContext(attemptId, questionId)
    if (practiceAttemptLimitExceeded(evalCtx.policy, evalCtx.attemptNumber)) {
      return NextResponse.json(
        { error: "Attempt limit reached for this question in this session." },
        { status: 429 },
      )
    }

    // Get question details from question_bank table
    const [question] = await sql`
      SELECT 
        id,
        correct_answer, 
        options,
        question_type,
        question_text,
        question_media,
        hint,
        expected_answer,
        sample_answer,
        answer_guidelines,
        subquestions,
        solution_upload_config,
        topic,
        difficulty
      FROM question_bank
      WHERE id = ${questionId}
    `

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const attemptStudentId = auth.studentDbId
    const tier = await getEffectiveMembershipTier(attemptStudentId)
    const level = practiceAccessLevelForTier(tier as MembershipTier)
    if (level === "none") {
      return NextResponse.json(
        {
          error: "Practice Hub requires Explorer or Trailblazer membership.",
          code: "PRACTICE_TIER_LOCKED",
        },
        { status: 403 },
      )
    }
    if (level === "partial" && evalCtx.courseId != null) {
      const topicRows = await sql`
        SELECT id FROM question_bank
        WHERE topic = ${question.topic}
          AND course_id = ${evalCtx.courseId}
          AND deleted_at IS NULL
        ORDER BY id ASC
      `
      const topicIds = topicRows.map((row) => Number(row.id))
      if (
        isPracticeQuestionLocked(
          tier as MembershipTier,
          Number(questionId),
          topicIds,
          evalCtx.policy,
        )
      ) {
        return NextResponse.json(
          {
            error: "This question requires Trailblazer membership.",
            code: "PRACTICE_QUESTION_LOCKED",
          },
          { status: 403 },
        )
      }
    }

    const resolveXp = (isCorrect: boolean) =>
      resolveServerPracticeXp(evalCtx.policy, isCorrect, {
        difficulty: difficulty ?? question.difficulty ?? null,
        responseTimeMs: responseTimeMs ?? null,
        attemptNumber: evalCtx.attemptNumber,
      })

    const actualQuestionType = questionType || question.question_type
    const maxPoints = 1 // Practice questions are typically 1 point each

    if (actualQuestionType === "circuit_submission" || actualQuestionType === "multi_part") {
      const studentDbId = auth.studentDbId

      const uploadEval = await evaluatePracticeUploadQuestion({
        questionType: actualQuestionType,
        question: question as Record<string, unknown>,
        answer,
        attemptId: attemptId ?? null,
        questionId: Number(questionId),
        responseTimeMs: responseTimeMs ?? null,
        xpEarned: resolveXp(true),
        difficulty: difficulty ?? question.difficulty ?? null,
        studentDbId,
      })

      if ("error" in uploadEval && uploadEval.error) {
        return NextResponse.json({ error: String(uploadEval.error) }, { status: 400 })
      }

      if (uploadEval.autoApproved && studentDbId && evalCtx.policy.sync_engagement_points) {
        try {
          const [studentRow] = await sql`
            SELECT section FROM students WHERE id = ${studentDbId} LIMIT 1
          `
          const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
          await syncActivityPointsAfterAction(
            studentDbId,
            String(studentRow?.section ?? "ALL"),
            "practice",
          )
        } catch (syncError) {
          console.warn("[Practice Evaluation] Trade Center sync failed:", syncError)
        }
      }

      return NextResponse.json(uploadEval)
    }

    const formattedQuestion = formatQuestionBankRowForRenderer({
      ...(question as Record<string, unknown>),
      id: questionId,
    })
    const optionA = formattedQuestion?.option_a ?? null
    const optionB = formattedQuestion?.option_b ?? null
    const optionC = formattedQuestion?.option_c ?? null
    const optionD = formattedQuestion?.option_d ?? null
    const optionE = formattedQuestion?.option_e ?? null

    console.log("[Practice Evaluation] Formatted question data:", {
      correct_answer: formattedQuestion?.correct_answer,
      option_a: optionA,
      option_b: optionB,
      question_type: actualQuestionType,
    })

    // Try local verification first for non-AI question types
    if (canVerifyLocally(actualQuestionType) && formattedQuestion) {
      console.log("[Practice Evaluation] Using local verification for:", actualQuestionType)
      
      try {
        const questionData = bankFormattedRowToVerifyPayload(formattedQuestion)
        
        const result = verifyAnswerLocally(actualQuestionType, answer, questionData)
        
        if (!result.requiresAI) {
          // Local verification successful
          const pointsEarned = (result.score / 100) * maxPoints
          const isCorrect = result.isCorrect

          const serverXp = resolveXp(isCorrect)

          let sideEffects: PracticeAnswerSideEffects | null = null
          if (attemptId) {
            try {
              sideEffects = await savePracticeAnswerWithSideEffects({
                attemptId,
                questionId,
                answer,
                isCorrect,
                responseTimeMs: responseTimeMs ?? null,
                xpEarned: serverXp,
                difficulty: difficulty ?? question.difficulty ?? null,
                studentDbId: attemptStudentId,
                topic: String(question.topic ?? ""),
              })
            } catch (saveError) {
              console.error("[Practice Evaluation] Failed to save locally verified answer:", saveError)
            }
          }

          console.log("[Practice Evaluation] Local verification result:", {
            isCorrect,
            score: result.score,
            pointsEarned,
            feedback: result.feedback
          })
          
          return NextResponse.json(
            attachAttemptProgress(
              withPracticeAnswerReview(
                question as Record<string, unknown>,
                answer,
                isCorrect,
                {
                  isCorrect,
                  points: pointsEarned,
                  score: result.score,
                  feedback: result.feedback,
                  locallyVerified: true,
                  maxPoints,
                  pointsEarned,
                  xpEarned: serverXp,
                },
                evalCtx.policy,
                undefined,
                undefined,
                questionId,
              ),
              sideEffects,
            ),
          )
        }
      } catch (localError) {
        console.error("[Practice Evaluation] Local verification failed:", localError)
        // Fall through to old logic as backup
      }
    }

    // Fallback to old logic for AI questions or if local verification fails
    let isCorrect = false
    console.log("[Practice Evaluation] Using fallback evaluation for:", actualQuestionType)

    if (actualQuestionType === "select_all" || actualQuestionType === "multi_output") {
      // Handle multiple choice questions (select all that apply)
      let correctAnswers: string[] = []
      let correctLetters: string[] = []
      
      // Handle JSONB correct_answer - could already be an array or a string
      if (Array.isArray(question.correct_answer)) {
        correctAnswers = question.correct_answer
      } else if (typeof question.correct_answer === 'string') {
        try {
          const parsed = JSON.parse(question.correct_answer)
          if (Array.isArray(parsed)) {
            correctAnswers = parsed
          } else {
            correctAnswers = question.correct_answer.split(",").map((a: string) => a.trim())
          }
        } catch {
          correctAnswers = question.correct_answer.split(",").map((a: string) => a.trim())
        }
      }

      // Convert letter answers to option text if needed
      if (correctAnswers.every((ans: string) => ["A", "B", "C", "D", "E"].includes(ans))) {
        correctLetters = correctAnswers.map((l) => l.toUpperCase())
        correctAnswers = correctAnswers.map((letter: string) => {
          switch (letter.toLowerCase()) {
            case 'a': return optionA
            case 'b': return optionB
            case 'c': return optionC
            case 'd': return optionD
            case 'e': return optionE
            default: return letter
          }
        }).filter((v): v is string => Boolean(v))
      }

      let studentAnswers = Array.isArray(answer) ? answer : []
      
      // Fallback: Convert student letters to option text if they're still letters
      if (studentAnswers.length > 0 && studentAnswers.every((ans: string) => ["A", "B", "C", "D", "E"].includes(String(ans)))) {
        studentAnswers = studentAnswers.map((letter: string) => {
          switch (String(letter).toLowerCase()) {
            case 'a': return optionA
            case 'b': return optionB
            case 'c': return optionC
            case 'd': return optionD
            case 'e': return optionE
            default: return letter
          }
        }).filter(Boolean)
      }
      
      console.log("[Practice Evaluation] Select All Comparison:", {
        correctAnswers,
        studentAnswers
      })
      
      // Check if all correct answers are selected and no incorrect ones
      const hasAllCorrect = correctAnswers.every((correct: string) => 
        studentAnswers.some((student: string) => 
          String(student).toLowerCase().trim() === String(correct).toLowerCase().trim()
        )
      )
      const hasNoIncorrect = studentAnswers.every((student: string) => 
        correctAnswers.some((correct: string) => 
          String(student).toLowerCase().trim() === String(correct).toLowerCase().trim()
        )
      )
      
      isCorrect = hasAllCorrect && hasNoIncorrect
      
      const selectAllXp = resolveXp(isCorrect)

      let selectAllSideEffects: PracticeAnswerSideEffects | null = null
      if (attemptId) {
        try {
          selectAllSideEffects = await savePracticeAnswerWithSideEffects({
            attemptId,
            questionId,
            answer,
            isCorrect,
            responseTimeMs: responseTimeMs ?? null,
            xpEarned: selectAllXp,
            difficulty: difficulty ?? question.difficulty ?? null,
            studentDbId: attemptStudentId,
            topic: String(question.topic ?? ""),
          })
        } catch (saveError) {
          console.error("[Practice Evaluation] Failed to save select-all answer:", saveError)
        }
      }

      return NextResponse.json(
        attachAttemptProgress(
          withPracticeAnswerReview(
            question as Record<string, unknown>,
            answer,
            isCorrect,
            { isCorrect, xpEarned: selectAllXp },
            evalCtx.policy,
            correctLetters.length > 0 ? correctLetters : undefined,
            correctAnswers,
            questionId,
          ),
          selectAllSideEffects,
        ),
      )
      
    } else if (actualQuestionType === "mcq" || actualQuestionType === "multiple_choice" || actualQuestionType === "true_false") {
      // Handle single choice questions
      let correctAnswer = question.correct_answer
      
      // Handle JSONB correct_answer - could be an array or a string
      if (Array.isArray(correctAnswer)) {
        correctAnswer = correctAnswer[0] || correctAnswer
      } else if (typeof correctAnswer === 'string') {
        try {
          const parsed = JSON.parse(correctAnswer)
          if (typeof parsed === "string") {
            correctAnswer = parsed
          } else if (Array.isArray(parsed) && parsed.length === 1) {
            correctAnswer = parsed[0]
          }
        } catch {
          // Keep as string
        }
      }
      
      // If correct answer is a letter, convert to option text
      if (["A", "B", "C", "D", "E"].includes(correctAnswer)) {
        switch (correctAnswer.toLowerCase()) {
          case 'a': correctAnswer = optionA || "True"; break
          case 'b': correctAnswer = optionB || "False"; break
          case 'c': correctAnswer = optionC || "C"; break
          case 'd': correctAnswer = optionD || "D"; break
          case 'e': correctAnswer = optionE || "E"; break
        }
        
        // Special handling for true_false questions
        if (actualQuestionType === "true_false") {
          if (correctAnswer.toLowerCase() === 'a') {
            correctAnswer = "True"
          } else if (correctAnswer.toLowerCase() === 'b') {
            correctAnswer = "False"
          }
        }
      }
      
      // Handle student answer - should already be converted to option text by frontend
      let studentAnswerText = String(answer)
      
      // Fallback: If student answer is still a letter, convert it
      if (["A", "B", "C", "D", "E"].includes(String(answer))) {
        switch (String(answer).toLowerCase()) {
          case 'a': studentAnswerText = optionA || "True"; break
          case 'b': studentAnswerText = optionB || "False"; break
          case 'c': studentAnswerText = optionC || "C"; break
          case 'd': studentAnswerText = optionD || "D"; break
          case 'e': studentAnswerText = optionE || "E"; break
        }
        
        // Special handling for true_false questions
        if (actualQuestionType === "true_false") {
          if (String(answer).toLowerCase() === 'a') {
            studentAnswerText = "True"
          } else if (String(answer).toLowerCase() === 'b') {
            studentAnswerText = "False"
          }
        }
      }
      
      console.log("[Practice Evaluation] MCQ/TF Comparison:", {
        correctAnswer: String(correctAnswer).toLowerCase().trim(),
        studentAnswer: String(studentAnswerText).toLowerCase().trim()
      })
      
      isCorrect = String(correctAnswer).toLowerCase().trim() === String(studentAnswerText).toLowerCase().trim()
      
    } else {
      // Handle other question types (fill_blank, code_output, trace_output, etc.)
      let correctAnswer = question.correct_answer
      let acceptedAnswers: string[] = []
      
      // Handle JSONB correct_answer - could be an array, string, or need parsing
      if (Array.isArray(correctAnswer)) {
        // Already an array from JSONB
        acceptedAnswers = correctAnswer.map((ans: any) => String(ans).toLowerCase().trim())
      } else if (typeof correctAnswer === 'string') {
        try {
          const parsed = JSON.parse(correctAnswer)
          if (Array.isArray(parsed)) {
            acceptedAnswers = parsed.map((ans: any) => String(ans).toLowerCase().trim())
          } else if (typeof parsed === "string") {
            acceptedAnswers = [String(parsed).toLowerCase().trim()]
          } else {
            acceptedAnswers = [String(correctAnswer).toLowerCase().trim()]
          }
        } catch {
          // Not JSON - could be comma-separated values
          if (String(correctAnswer).includes(',')) {
            acceptedAnswers = String(correctAnswer)
              .split(',')
              .map((ans: string) => ans.toLowerCase().trim())
          } else {
            acceptedAnswers = [String(correctAnswer).toLowerCase().trim()]
          }
        }
      } else {
        // Other type, convert to string
        acceptedAnswers = [String(correctAnswer).toLowerCase().trim()]
      }

      const studentAnswerText = String(answer).toLowerCase().trim()
      
      console.log("[Practice Evaluation] Fill-in-Blank Comparison:", {
        acceptedAnswers,
        studentAnswer: studentAnswerText,
        questionType: actualQuestionType
      })

      // Check if student answer matches any accepted answer
      if (actualQuestionType === "fill_blank" || actualQuestionType === "code_output" || actualQuestionType === "trace_output") {
        // Exact match (case-insensitive, trimmed)
        isCorrect = acceptedAnswers.some(accepted => accepted === studentAnswerText)
        
        // If not exact match, try fuzzy matching for common variations
        if (!isCorrect && actualQuestionType === "fill_blank") {
          // Remove common punctuation and extra spaces
          const normalizeText = (text: string) => 
            text.replace(/[.,;:!?'"()[\]{}]/g, '').replace(/\s+/g, ' ').trim()
          
          const normalizedStudent = normalizeText(studentAnswerText)
          isCorrect = acceptedAnswers.some(accepted => 
            normalizeText(accepted) === normalizedStudent
          )
        }
      } else {
        // For other types, exact match
        isCorrect = acceptedAnswers.some(accepted => accepted === studentAnswerText)
      }
    }

    console.log("[Practice Evaluation] Result:", isCorrect ? "CORRECT" : "INCORRECT")

    const finalXp = resolveXp(isCorrect)

    let fallbackSideEffects: PracticeAnswerSideEffects | null = null
    if (attemptId) {
      try {
        console.log("[Practice Evaluation] Saving answer to database...")
        fallbackSideEffects = await savePracticeAnswerWithSideEffects({
          attemptId,
          questionId,
          answer,
          isCorrect,
          responseTimeMs: responseTimeMs ?? null,
          xpEarned: finalXp,
          difficulty: difficulty ?? question.difficulty ?? null,
          studentDbId: attemptStudentId,
          topic: String(question.topic ?? ""),
        })
        console.log("[Practice Evaluation] Answer saved successfully | XP:", finalXp, "| Response time:", responseTimeMs, "ms")
      } catch (saveError) {
        console.error("[Practice Evaluation] Failed to save answer:", saveError)
      }
    }

    return NextResponse.json(
      attachAttemptProgress(
        withPracticeAnswerReview(
          question as Record<string, unknown>,
          answer,
          isCorrect,
          { isCorrect, xpEarned: finalXp },
          evalCtx.policy,
          undefined,
          undefined,
          questionId,
        ),
        fallbackSideEffects,
      ),
    )
  } catch (error) {
    console.error("[Practice Evaluation] Error:", error)
    return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 })
  }
}
