import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { evaluateCode } from "@/lib/ai-evaluate-code"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { scoreSelectAllQuestion } from "@/lib/select-all-scoring"
import { buildLocalVerifyQuestionData } from "@/lib/assessment-verify-payload"
import { resolvePlotImageForCodeWritePlot } from "@/lib/code-write-plot-answer"
import { resolveEvaluationLanguageList } from "@/lib/ai-code-languages"
import { getQuizQuestionForEvaluateResolved } from "@/lib/resolve-quiz-question-from-bank"
import {
  isRegularAssessmentTypeForSemesterCutoff,
  regularAssessmentsClosedMessage,
} from "@/lib/regular-assessments-cutoff"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"
import {
  AssessmentEvaluateHttpError,
  buildAssessmentCoreEvaluateResponse,
  isAssessmentCoreEvalType,
} from "@/lib/assessment-core/evaluate-http"
import { getAnswerChangeBlockReasonForRequest } from "@/lib/quiz-answer-lock"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export const runtime = "nodejs"
export const maxDuration = 180 // 3min for AI evaluation (can take 60-90s)

export async function POST(request: NextRequest) {
  try {
    const { questionId, answer, questionType, plotImage, typingReplay, attemptId } = await request.json()

    if (!questionId || answer === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const qtIncoming = (questionType || "").toLowerCase()

    // circuit_submission, multi_part, circuit_upload_work, etc. — vision / core AI pipeline
    if (isAssessmentCoreEvalType(qtIncoming)) {
      if (!attemptId) {
        return NextResponse.json(
          { error: "Missing attemptId for evaluation" },
          { status: 400 },
        )
      }
      try {
        const payload = await buildAssessmentCoreEvaluateResponse({
          assessmentType: "quiz",
          questionId: Number(questionId),
          answer,
          questionType: qtIncoming,
          attemptId: Number(attemptId),
          plotImage,
          typingReplay: typingReplay ?? undefined,
        })
        return NextResponse.json(payload)
      } catch (err) {
        if (err instanceof AssessmentEvaluateHttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status })
        }
        throw err
      }
    }

    const question = await getQuizQuestionForEvaluateResolved(Number(questionId))

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const aq = (question as { quiz_assessment_type?: string }).quiz_assessment_type
    if (isRegularAssessmentTypeForSemesterCutoff(aq) && attemptId) {
      const attemptOwner = await sql`
        SELECT student_id FROM quiz_attempts WHERE id = ${Number(attemptId)} AND deleted_at IS NULL LIMIT 1
      `
      const ownerId = Number(attemptOwner[0]?.student_id) || 0
      if (
        ownerId > 0 &&
        (await isRegularAssessmentSemesterHardCloseBlockingStudent(ownerId))
      ) {
        return NextResponse.json({ error: regularAssessmentsClosedMessage() }, { status: 403 })
      }
    }

    const actualQuestionType = (questionType || question.question_type || "mcq").toLowerCase()

    if (attemptId && canVerifyLocally(actualQuestionType)) {
      const lockReason = await getAnswerChangeBlockReasonForRequest(
        request,
        Number(attemptId),
        Number(questionId),
        actualQuestionType,
        { incomingAnswer: answer },
      )
      if (lockReason) {
        return NextResponse.json({ error: lockReason, locked: true }, { status: 409 })
      }
    }

    // Fallback: client omitted questionType but DB row is circuit_submission / multi_part / etc.
    if (isAssessmentCoreEvalType(actualQuestionType)) {
      if (!attemptId) {
        return NextResponse.json(
          { error: "Missing attemptId for evaluation" },
          { status: 400 },
        )
      }
      try {
        const payload = await buildAssessmentCoreEvaluateResponse({
          assessmentType: "quiz",
          questionId: Number(questionId),
          answer,
          questionType: actualQuestionType,
          attemptId: Number(attemptId),
          plotImage,
          typingReplay: typingReplay ?? undefined,
        })
        return NextResponse.json(payload)
      } catch (err) {
        if (err instanceof AssessmentEvaluateHttpError) {
          return NextResponse.json({ error: err.message }, { status: err.status })
        }
        throw err
      }
    }
    // Use COALESCE(max_points, points, 1) to get the correct point value
    // This ensures we use max_points if set, otherwise points, otherwise default to 1
    const maxPoints = Number(question.effective_max_points) || 1
    
    // Try local verification first for non-AI question types
    if (canVerifyLocally(actualQuestionType)) {
      
      try {
        // Pass question options for proper verification
        const questionData = buildLocalVerifyQuestionData(question)
        
        const result = verifyAnswerLocally(actualQuestionType, answer, questionData)
        
        // Auto-key types (MCQ, T/F, select_all, etc.) always grade locally — never AI
        const pointsEarned = parseFloat(((result.score / 100) * maxPoints).toFixed(2))
        
        return NextResponse.json({
          isCorrect: result.isCorrect,
          score: result.score,
          pointsEarned: pointsEarned,
          maxPoints: maxPoints,
          feedback: result.feedback,
          aiGraded: false,
          locallyVerified: true,
          requiresManualReview: false
        })
      } catch (localError) {
        console.error("[Quiz Evaluation] Local verification failed:", localError)
        return NextResponse.json({
          isCorrect: false,
          score: 0,
          pointsEarned: 0,
          maxPoints,
          feedback: "Could not verify answer against the answer key.",
          aiGraded: false,
          locallyVerified: true,
          requiresManualReview: false,
        })
      }
    }

    // Check if this is an AI-graded question type
    const aiGradedTypes = ['code_write', 'code_explain', 'code_problem', 'debug_code', 'code_debug', 'code_write_plot']
    
    if (aiGradedTypes.includes(actualQuestionType)) {
      // Call AI evaluation directly (no internal HTTP fetch)
      let codeToEvaluate = answer
      if (actualQuestionType === "code_write_plot" && typeof answer === 'string') {
        try {
          const parsed = JSON.parse(answer)
          if (parsed.code) {
            codeToEvaluate = parsed.code
          }
        } catch {
          // Not JSON, use as-is
        }
      }

      const plotForEval =
        actualQuestionType === "code_write_plot"
          ? resolvePlotImageForCodeWritePlot(answer, plotImage)
          : plotImage

      const qRow = question as { code_language?: string; allowed_ai_code_languages?: unknown; ai_code_language?: string | null }
      const allowedList = resolveEvaluationLanguageList({
        questionAiCodeLanguage: qRow.ai_code_language,
        quizAllowedAiCodeLanguages: qRow.allowed_ai_code_languages,
        quizFallbackCodeLanguage: qRow.code_language,
      })
      const referenceAnswer = resolveReferenceAnswerForAiGrading(question)
      const aiResult = await evaluateCode({
        questionType: actualQuestionType,
        questionText: question.question_text || "",
        studentAnswer: typeof codeToEvaluate === "string" ? codeToEvaluate : JSON.stringify(codeToEvaluate),
        correctAnswer: referenceAnswer ?? question.correct_answer,
        rubric: question.hint,
        maxPoints,
        plotImage: plotForEval,
        aiEvaluationMode: question.ai_evaluation_mode || 'standard',
        codeLanguage: allowedList[0] || "cpp",
        allowedCodeLanguages: allowedList.length > 1 ? allowedList : undefined,
        typingReplay: typingReplay ?? undefined,
      })

      const pointsEarned =
        typeof aiResult.pointsEarned === "number" && Number.isFinite(aiResult.pointsEarned)
          ? parseFloat(aiResult.pointsEarned.toFixed(2))
          : parseFloat(((aiResult.score / 100) * maxPoints).toFixed(2))

      return NextResponse.json({
        isCorrect: aiResult.isCorrect,
        score: aiResult.score,
        pointsEarned,
        maxPoints,
        feedback: aiResult.feedback || aiResult.statusMessage,
        criteria: aiResult.criteria,
        suggestions: aiResult.suggestions,
        detailedExplanation: aiResult.detailedExplanation,
        gradeBreakdown: aiResult.gradeBreakdown,
        itemizedIssues: aiResult.itemizedIssues,
        sampleAnswers: aiResult.sampleAnswers,
        status: aiResult.status,
        statusMessage: aiResult.statusMessage,
        aiFeedback: {
          score: aiResult.score,
          feedback: aiResult.feedback || aiResult.statusMessage,
          criteria: aiResult.criteria,
          suggestions: aiResult.suggestions,
          detailedExplanation: aiResult.detailedExplanation,
          gradeBreakdown: aiResult.gradeBreakdown,
          scoreBreakdown: aiResult.scoreBreakdown,
          itemizedIssues: aiResult.itemizedIssues,
          sampleAnswers: aiResult.sampleAnswers,
          status: aiResult.status,
          statusMessage: aiResult.statusMessage,
          evaluationDiagnostics: aiResult.evaluationDiagnostics,
        },
        aiGraded: aiResult.aiGraded,
        requiresManualReview: aiResult.requiresManualReview || false,
        errorType: aiResult.errorType,
        technicalError: aiResult.fallbackReason,
        evaluationDiagnostics: aiResult.evaluationDiagnostics,
      })
    }


    // Helper function to convert letter to option text
    const convertLetterToOption = (letter: string): string => {
      const optionMap: Record<string, string> = {
        'A': question.option_a,
        'B': question.option_b,
        'C': question.option_c,
        'D': question.option_d,
        'E': question.option_e || ""
      }
      return optionMap[letter.toUpperCase()] || letter
    }

    let isCorrect = false

    if (actualQuestionType === "select_all" || actualQuestionType === "multi_output") {
      // Handle multiple choice questions (select all that apply)
      let correctAnswers: string[] = []
      
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

      // Convert letter answers to option text if needed
      if (correctAnswers.every((ans: string) => ["A", "B", "C", "D", "E"].includes(ans))) {
        correctAnswers = correctAnswers.map(convertLetterToOption).filter(Boolean)
      }

      let studentAnswers = Array.isArray(answer) ? answer : []
      
      // Convert student letters to option text if they're still letters
      if (studentAnswers.length > 0 && studentAnswers.every((ans: string) => ["A", "B", "C", "D", "E"].includes(String(ans)))) {
        studentAnswers = studentAnswers.map((letter: string) => convertLetterToOption(String(letter))).filter(Boolean)
      }
      
      console.log("[Quiz Evaluation] Select All Comparison:", {
        correctAnswers,
        studentAnswers
      })
      
      const scored = scoreSelectAllQuestion(studentAnswers, correctAnswers, maxPoints)
      isCorrect = scored.isFullyCorrect
      return NextResponse.json({
        isCorrect,
        score: Math.round(scored.fraction * 10000) / 100,
        pointsEarned: scored.points,
        maxPoints,
        locallyVerified: true,
      })
      
    } else if (actualQuestionType === "mcq" || actualQuestionType === "true_false") {
      // Handle single choice questions
      let correctAnswer = question.correct_answer
      
      // Parse correct answer if it's a JSON string
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
      
      // If correct answer is a letter, convert to option text
      if (["A", "B", "C", "D", "E"].includes(correctAnswer)) {
        correctAnswer = convertLetterToOption(correctAnswer)
      }
      
      // Handle student answer - should be converted to option text by frontend
      let studentAnswerText = String(answer)
      
      // Fallback: If student answer is still a letter, convert it
      if (["A", "B", "C", "D", "E"].includes(String(answer))) {
        studentAnswerText = convertLetterToOption(String(answer))
      }
      
      console.log("[Quiz Evaluation] MCQ/TF Comparison:", {
        correctAnswer: String(correctAnswer).toLowerCase().trim(),
        studentAnswer: String(studentAnswerText).toLowerCase().trim()
      })
      
      isCorrect = String(correctAnswer).toLowerCase().trim() === String(studentAnswerText).toLowerCase().trim()
      
    } else {
      // Handle other question types (fill_blank, code_output, trace_output, etc.)
      let correctAnswer = question.correct_answer
      let acceptedAnswers: string[] = []
      
      // Parse correct answer - could be JSON array of multiple acceptable answers
      try {
        const parsed = JSON.parse(correctAnswer)
        if (Array.isArray(parsed)) {
          // Multiple acceptable answers
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

      const studentAnswerText = String(answer).toLowerCase().trim()
      
      console.log("[Quiz Evaluation] Fill-in-Blank Comparison:", {
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

    console.log("[Quiz Evaluation] Result:", isCorrect ? "CORRECT" : "INCORRECT")

    return NextResponse.json({ isCorrect })
  } catch (error) {
    console.error("[Quiz Evaluation] Error:", error)
    return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 })
  }
}
