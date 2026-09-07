import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"
import * as crypto from "crypto"

export const dynamic = 'force-dynamic'

interface QuestionSelectionCriteria {
  topics: string[]
  difficultyDistribution: { easy: number; medium: number; hard: number }
  limit: number
  types?: string[]
}

interface ExamQuestion {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string
  options: any
  correct_answer: any
  hint?: string
  evaluation_mode?: string
  answer_guidelines?: string
  sample_answer?: string
  explanation?: string
  points: number
  timeAllocation: number
  antiCheatExempt?: boolean // For MATLAB or external tool tasks
  anti_cheat_exempt?: boolean // Database column name
  requiresUpload?: boolean // For file upload questions
}

/**
 * Calculate points based on difficulty
 */
function getPointsForDifficulty(difficulty: string): number {
  switch (difficulty.toLowerCase()) {
    case 'easy': return 3
    case 'medium': return 4
    case 'hard': return 5
    default: return 4
  }
}

/**
 * Calculate time allocation based on difficulty and question type
 */
function getTimeForDifficulty(difficulty: string, questionType: string): number {
  // C++ Code-Write questions: 5 minutes each
  if (questionType === 'code_write' || questionType === 'code_problem') {
    return 5 * 60 // 5 minutes in seconds
  }

  // MATLAB Plot-Based questions: 5 minutes each
  if (questionType === 'code_write_plot' || questionType.includes('matlab')) {
    return 5 * 60 // 5 minutes in seconds
  }

  // MCQ/True-False/Select-All questions: based on difficulty
  const baseTime = {
    'easy': 60,      // 1 minute
    'medium': 90,    // 1.5 minutes
    'hard': 120      // 2 minutes
  }[difficulty.toLowerCase()] || 90

  return baseTime
}

/**
 * Fetch questions from question bank based on criteria
 */
async function fetchQuestions(criteria: QuestionSelectionCriteria): Promise<ExamQuestion[]> {
  const { topics, difficultyDistribution, limit, types } = criteria

  // Use the same pattern as question-bank route: sql template literal with sql.unsafe for WHERE clause
  let questions: any[] = []
  
  try {
    // Build WHERE conditions as strings (like question-bank route does)
    const whereConditions: string[] = []
    
    if (topics && topics.length > 0) {
      const topicConditions = topics.map(t => `topic ILIKE '%${String(t).replace(/'/g, "''")}%'`).join(' OR ')
      whereConditions.push(`(${topicConditions})`)
    }
    
    if (types && types.length > 0) {
      const typeList = types.map(t => `'${String(t).replace(/'/g, "''")}'`).join(',')
      whereConditions.push(`question_type IN (${typeList})`)
    }
    
    const whereClause = whereConditions.length > 0 ? ` AND ${whereConditions.join(' AND ')}` : ""
    
    // Use sql template literal with sql.unsafe for WHERE clause (proven working pattern)
    const result = whereClause
      ? await sql`
          SELECT 
            id,
            question_text,
            question_type,
            difficulty,
            topic,
            options,
            correct_answer,
            hint,
            evaluation_mode,
            answer_guidelines,
            sample_answer,
            explanation,
            COALESCE(points, NULL) as points,
            COALESCE(anti_cheat_exempt, FALSE) as anti_cheat_exempt
          FROM question_bank
          WHERE deleted_at IS NULL ${sql.unsafe(whereClause)}
          ORDER BY RANDOM()
          LIMIT ${limit * 10}
        `
      : await sql`
          SELECT 
            id,
            question_text,
            question_type,
            difficulty,
            topic,
            options,
            correct_answer,
            hint,
            evaluation_mode,
            answer_guidelines,
            sample_answer,
            explanation,
            COALESCE(points, NULL) as points,
            COALESCE(anti_cheat_exempt, FALSE) as anti_cheat_exempt
          FROM question_bank
          WHERE deleted_at IS NULL
          ORDER BY RANDOM()
          LIMIT ${limit * 10}
        `
    
    questions = Array.isArray(result) ? result : []
    console.log(`[fetchQuestions] Found ${questions.length} questions matching criteria`)
  } catch (error: any) {
    console.error(`[fetchQuestions] Error fetching questions:`, error.message)
    questions = []
  }

  // Group by difficulty and select according to distribution
  const easyQuestions = questions.filter((q: any) => q.difficulty?.toLowerCase() === 'easy')
  const mediumQuestions = questions.filter((q: any) => q.difficulty?.toLowerCase() === 'medium')
  const hardQuestions = questions.filter((q: any) => q.difficulty?.toLowerCase() === 'hard')

  const total = limit
  const easyCount = Math.round(total * (difficultyDistribution.easy / 100))
  const mediumCount = Math.round(total * (difficultyDistribution.medium / 100))
  const hardCount = total - easyCount - mediumCount

  const selectedQuestions: ExamQuestion[] = []

  // Select easy questions
  selectedQuestions.push(
    ...easyQuestions.slice(0, easyCount).map((q: any) => ({
      ...q,
      points: getPointsForDifficulty(q.difficulty),
      timeAllocation: getTimeForDifficulty(q.difficulty, q.question_type)
    }))
  )

  // Select medium questions
  selectedQuestions.push(
    ...mediumQuestions.slice(0, mediumCount).map((q: any) => ({
      ...q,
      points: getPointsForDifficulty(q.difficulty),
      timeAllocation: getTimeForDifficulty(q.difficulty, q.question_type)
    }))
  )

  // Select hard questions
  selectedQuestions.push(
    ...hardQuestions.slice(0, hardCount).map((q: any) => ({
      ...q,
      points: getPointsForDifficulty(q.difficulty),
      timeAllocation: getTimeForDifficulty(q.difficulty, q.question_type)
    }))
  )

  // If we don't have enough questions, fill from remaining pool
  if (selectedQuestions.length < total) {
    const remaining = total - selectedQuestions.length
    const usedIds = new Set(selectedQuestions.map(q => q.id))
    const remainingQuestions = questions
      .filter((q: any) => !usedIds.has(q.id))
      .slice(0, remaining)
      .map((q: any) => ({
        ...q,
        points: getPointsForDifficulty(q.difficulty),
        timeAllocation: getTimeForDifficulty(q.difficulty, q.question_type)
      }))
    selectedQuestions.push(...remainingQuestions)
  }

  // Shuffle the selected questions
  return selectedQuestions.sort(() => Math.random() - 0.5).slice(0, total)
}

/**
 * Generate Final Exam according to specifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      instructorId,
      examName = "Spring 2025 Final Exam",
      testMode = false,
      sessionCodes = null, // Will fetch from database if not provided
      availableFrom,
      availableUntil
    } = body

    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    // Ensure instructorId is a number
    const instructorIdNum = typeof instructorId === 'string' ? Number(instructorId) : instructorId
    if (isNaN(instructorIdNum)) {
      return NextResponse.json({ error: "Invalid instructor ID" }, { status: 400 })
    }

    console.log("[Final Exam Generator] Starting exam generation with instructorId:", instructorIdNum)

    // 1. Generate MCQ/True-False/Select-All Questions (15 questions, 60 points)
    // Section A: Objective Questions - 60 points total
    // Selection Criteria (Easy): 2 @ 3 pts = 6 pts
    // Loops (Medium): 3 @ 4 pts = 12 pts
    // Functions (Medium): 3 @ 4 pts = 12 pts
    // Arrays (Hard): 3 @ 5 pts = 15 pts
    // Pointers (Hard): 2 @ 5 pts = 10 pts
    // MATLAB Basics (Easy): 2 @ 2.5 pts = 5 pts
    // Total: 15 questions, 60 points

    const mcqTopics = [
      "Selection Criteria",
      "Performing Repetitions: Loops",
      "C++ Functions",
      "Arrays",
      "Pointers",
      "MATLAB"
    ]

    const mcqTypes = ["mcq", "true_false", "select_all"]
    
    // Fetch questions by specific topic and difficulty requirements
    const selectionCriteriaQuestions = await fetchQuestions({
      topics: ["Selection Criteria"],
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
      limit: 2,
      types: mcqTypes
    })
    
    const loopsQuestions = await fetchQuestions({
      topics: ["Performing Repetitions: Loops", "Loops"],
      difficultyDistribution: { easy: 0, medium: 100, hard: 0 },
      limit: 3,
      types: mcqTypes
    })
    
    const functionsQuestions = await fetchQuestions({
      topics: ["C++ Functions", "Functions"],
      difficultyDistribution: { easy: 0, medium: 100, hard: 0 },
      limit: 3,
      types: mcqTypes
    })
    
    const arraysQuestions = await fetchQuestions({
      topics: ["Arrays"],
      difficultyDistribution: { easy: 0, medium: 0, hard: 100 },
      limit: 3,
      types: mcqTypes
    })
    
    const pointersQuestions = await fetchQuestions({
      topics: ["Pointers"],
      difficultyDistribution: { easy: 0, medium: 0, hard: 100 },
      limit: 2,
      types: mcqTypes
    })
    
    const matlabMcqQuestions = await fetchQuestions({
      topics: ["MATLAB"],
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
      limit: 2,
      types: mcqTypes
    })

    // Combine all MCQ questions
    const mcqQuestions = [
      ...selectionCriteriaQuestions,
      ...loopsQuestions,
      ...functionsQuestions,
      ...arraysQuestions,
      ...pointersQuestions,
      ...matlabMcqQuestions
    ]

    // Assign points based on topic and difficulty (exact specification)
    // Use points from database if available, otherwise calculate based on topic/difficulty
    mcqQuestions.forEach(q => {
      const topic = (q.topic || '').toLowerCase()
      const difficulty = q.difficulty?.toLowerCase() || 'medium'
      
      // Use points from database if available
      if (q.points && q.points > 0) {
        // Points already set from database, just set time allocation
        if (difficulty === 'easy') {
          q.timeAllocation = 1 * 60 // 1 minute
        } else if (difficulty === 'hard') {
          q.timeAllocation = 2 * 60 // 2 minutes
        } else {
          q.timeAllocation = 1.5 * 60 // 1.5 minutes
        }
      } else {
        // Calculate points based on topic and difficulty
        // Selection Criteria (Easy): 3 pts
        if (topic.includes('selection criteria') && difficulty === 'easy') {
          q.points = 3
          q.timeAllocation = 1 * 60 // 1 minute
        }
        // Loops (Medium): 4 pts
        else if ((topic.includes('loops') || topic.includes('repetitions')) && difficulty === 'medium') {
          q.points = 4
          q.timeAllocation = 1.5 * 60 // 1.5 minutes
        }
        // Functions (Medium): 4 pts
        else if (topic.includes('functions') && difficulty === 'medium') {
          q.points = 4
          q.timeAllocation = 1.5 * 60 // 1.5 minutes
        }
        // Arrays (Hard): 5 pts
        else if (topic.includes('arrays') && difficulty === 'hard') {
          q.points = 5
          q.timeAllocation = 2 * 60 // 2 minutes
        }
        // Pointers (Hard): 5 pts
        else if (topic.includes('pointers') && difficulty === 'hard') {
          q.points = 5
          q.timeAllocation = 2 * 60 // 2 minutes
        }
        // MATLAB Basics (Easy): 2.5 pts
        else if (topic.includes('matlab') && difficulty === 'easy') {
          q.points = 2.5
          q.timeAllocation = 1 * 60 // 1 minute
        }
        // Fallback based on difficulty
        else {
          if (difficulty === 'easy') {
            q.points = 3
            q.timeAllocation = 1 * 60
          } else if (difficulty === 'hard') {
            q.points = 5
            q.timeAllocation = 2 * 60
          } else {
            q.points = 4
            q.timeAllocation = 1.5 * 60
          }
        }
      }
    })

    // 2. Generate C++ Code-Write Questions (6 questions, 30 points)
    // Section B: Code Write (C++) - 30 points total
    // Easy (Loops/Arrays/Functions): 4 @ 4 pts = 16 pts
    // Medium (Pointers/Function Logic): 2 @ 7 pts = 14 pts
    // Total: 6 questions, 30 points

    const cppTopics = [
      "C++ Functions",
      "Performing Repetitions: Loops",
      "Arrays",
      "Pointers"
    ]

    // Fetch 4 easy C++ questions (Loops/Arrays/Functions)
    const cppEasyQuestions = await fetchQuestions({
      topics: ["C++ Functions", "Performing Repetitions: Loops", "Arrays"],
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
      limit: 4,
      types: ["code_write", "code_problem"]
    })

    // Fetch 2 medium C++ questions (Pointers/Function Logic)
    const cppMediumQuestions = await fetchQuestions({
      topics: ["Pointers", "C++ Functions"],
      difficultyDistribution: { easy: 0, medium: 100, hard: 0 },
      limit: 2,
      types: ["code_write", "code_problem"]
    })

    const cppQuestions = [...cppEasyQuestions, ...cppMediumQuestions]

    // Assign points: Easy = 4 pts, Medium = 7 pts
    // Use points from database if available, otherwise calculate
    cppQuestions.forEach((q) => {
      const difficulty = q.difficulty?.toLowerCase() || 'medium'
      
      // Use points from database if available
      if (q.points && q.points > 0) {
        // Points already set from database
      } else {
        // Calculate points based on difficulty
        if (difficulty === 'easy') {
          q.points = 4 // 4 easy × 4 pts = 16 pts
        } else {
          q.points = 7 // 2 medium × 7 pts = 14 pts
        }
      }
      q.timeAllocation = 5 * 60 // 5 minutes in seconds
    })

    // 3. Generate MATLAB Code-Write with Plots (2 questions, 10 points)
    const matlabQuestions = await fetchQuestions({
      topics: ["MATLAB"],
      difficultyDistribution: { easy: 100, medium: 0, hard: 0 },
      limit: 2,
      types: ["code_write_plot", "code_problem"]
    })

    // 5 points each - Mark MATLAB questions as anti-cheat exempt
    matlabQuestions.forEach(q => {
      q.points = 5
      q.timeAllocation = 5 * 60 // 5 minutes in seconds
      q.antiCheatExempt = true // Disable anti-cheat for MATLAB plot uploads
      q.requiresUpload = true // Requires file upload
    })

    // Combine all questions
    const allQuestions = [...mcqQuestions, ...cppQuestions, ...matlabQuestions]

    // Verify total points = 100
    const totalPoints = allQuestions.reduce((sum, q) => sum + q.points, 0)
    if (Math.abs(totalPoints - 100) > 1) {
      console.warn(`[Final Exam Generator] Point total is ${totalPoints}, adjusting to 100`)
      const adjustment = 100 - totalPoints
      if (allQuestions.length > 0) {
        allQuestions[0].points += adjustment
      }
    }

    // Verify total time ≈ 60 minutes
    const totalTimeSeconds = allQuestions.reduce((sum, q) => sum + q.timeAllocation, 0)
    const totalTimeMinutes = totalTimeSeconds / 60
    console.log(`[Final Exam Generator] Total time: ${totalTimeMinutes} minutes`)

    // Create exam configuration
    const examConfig = {
      title: examName,
      description: "Final Exam – Fall 2025 - C++, MATLAB, and Programming Fundamentals",
      totalQuestions: allQuestions.length,
      totalPoints: 100,
      duration: 60, // minutes (updated: ~60 minutes total)
      antiCheat: {
        enabled: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        disableCopyPaste: true,
        fullscreenRequired: true,
        tabChangeDetection: true,
        maxTabChanges: 5,
        autoSave: true,
        questionIdHashing: true
      },
      sections: [
        {
          name: "Section A - Objective Questions (MCQ / True / Select-All)",
          questionCount: mcqQuestions.length,
          points: 60,
          timeAllocation: 25 // minutes (as per spec)
        },
        {
          name: "Section B - Code Writing (C++)",
          questionCount: cppQuestions.length,
          points: 30,
          timeAllocation: 30 // minutes (6 questions × 5 min each)
        },
        {
          name: "Section C - MATLAB Plot Upload",
          questionCount: matlabQuestions.length,
          points: 10,
          timeAllocation: 10 // minutes (2 questions × 5 min each)
        }
      ]
    }

    // If test mode, return preview without saving
    if (testMode) {
      return NextResponse.json({
        success: true,
        testMode: true,
        examConfig,
        questions: allQuestions,
        summary: {
          totalQuestions: allQuestions.length,
          totalPoints: allQuestions.reduce((sum, q) => sum + q.points, 0),
          totalTimeMinutes: Math.round(totalTimeMinutes),
          mcqCount: mcqQuestions.length,
          cppCount: cppQuestions.length,
          matlabCount: matlabQuestions.length
        }
      })
    }

    // Calculate exam dates (default: December 1, 2025 at 9:00 AM Central Time)
    const defaultStartDate = new Date('2025-12-01T09:00:00-06:00')
    const examStartDate = availableFrom ? new Date(availableFrom) : defaultStartDate
    const examEndDate = availableUntil 
      ? new Date(availableUntil) 
      : new Date(examStartDate.getTime() + examConfig.duration * 60 * 1000)

    // Create the exam in database
    // Use created_by (the actual column name) instead of instructor_id
    const examResult = await sql`
      INSERT INTO quizzes (
        title,
        description,
        assessment_type,
        created_by,
        time_per_question,
        is_saved,
        available_from,
        available_until,
        beta_only,
        created_at
      ) VALUES (
        ${examConfig.title},
        ${examConfig.description},
        'final',
        ${instructorIdNum},
        ${allQuestions.length > 0 ? Math.round((examConfig.duration * 60) / allQuestions.length) : 60}, -- Average time per question
        true,
        ${examStartDate},
        ${examEndDate},
        ${(examConfig as any).betaOnly || false}, -- Default to false (all students can access)
        NOW()
      ) RETURNING id
    `

    const examResultArray = Array.isArray(examResult) ? examResult : [examResult]
    const examId = examResultArray.length > 0 && examResultArray[0] && typeof examResultArray[0] === 'object' && 'id' in examResultArray[0]
      ? (examResultArray[0] as any).id
      : null
    if (!examId) {
      throw new Error("Failed to create exam")
    }

    // Insert questions into quiz_questions
    // Use EXACT same parsing logic as quizzes/homeworks/mid-semester exams
    for (let i = 0; i < allQuestions.length; i++) {
      const q = allQuestions[i]

      // Parse options from JSONB array format (EXACT same as quiz creation)
      let options = []
      try {
        // Handle both string (needs parsing) and already-parsed array/object from Neon
        if (typeof q.options === 'string') {
          options = JSON.parse(q.options || "[]")
        } else if (Array.isArray(q.options)) {
          options = q.options
        } else {
          options = []
        }
      } catch (e) {
        console.error("[Exam Generate] Failed to parse options for question", q.id, e)
        options = []
      }

      const optionA = options[0] || null
      const optionB = options[1] || null
      const optionC = options[2] || null
      const optionD = options[3] || null
      const optionE = options[4] || null

      // Parse correct_answer (EXACT same logic as quiz creation from bank)
      let correctAnswer = "A" // Default
      if (q.correct_answer) {
        try {
          // Handle both string (needs parsing) and already-parsed from Neon
          let parsed = q.correct_answer
          if (typeof q.correct_answer === 'string') {
            try {
              parsed = JSON.parse(q.correct_answer)
            } catch (e) {
              // Not JSON, use as-is
              parsed = q.correct_answer
            }
          }

          if (typeof parsed === "string" && ["A", "B", "C", "D", "E"].includes(parsed.trim())) {
            correctAnswer = parsed.trim()
          }
          // If it's an array (for multi-select), convert to JSON string (EXACT same as quiz creation)
          else if (Array.isArray(parsed)) {
            correctAnswer = JSON.stringify(parsed)
          }
          // Otherwise, assume it's the answer text and find the matching option
          else {
            const answerText = String(parsed).trim()
            if (answerText === optionA) correctAnswer = "A"
            else if (answerText === optionB) correctAnswer = "B"
            else if (answerText === optionC) correctAnswer = "C"
            else if (answerText === optionD) correctAnswer = "D"
            else if (answerText === optionE) correctAnswer = "E"
            else {
              console.warn(`[Exam Generate] Could not match correct_answer "${answerText}" to any option for question ${q.id}`)
            }
          }
        } catch (e) {
          // If parsing fails, treat as plain string
          const answerText = String(q.correct_answer).trim()
          if (["A", "B", "C", "D", "E"].includes(answerText)) {
            correctAnswer = answerText
          } else if (answerText === optionA) {
            correctAnswer = "A"
          } else if (answerText === optionB) {
            correctAnswer = "B"
          } else if (answerText === optionC) {
            correctAnswer = "C"
          } else if (answerText === optionD) {
            correctAnswer = "D"
          } else if (answerText === optionE) {
            correctAnswer = "E"
          }
        }
      }

      console.log(`[Exam Generate] Q${q.id} final correctAnswer: "${correctAnswer}"`)

      console.log(`[Exam Generate] Q${q.id} final correctAnswer: "${correctAnswer}"`)

      // Get anti_cheat_exempt from question or use default
      const antiCheatExempt = (q.anti_cheat_exempt === true) || (q.antiCheatExempt === true)

      await sql`
        INSERT INTO quiz_questions (
          quiz_id,
          bank_question_id,
          question_text,
          question_type,
          option_a,
          option_b,
          option_c,
          option_d,
          option_e,
          correct_answer,
          question_order,
          time_limit,
          points,
          anti_cheat_exempt,
          created_at
        ) VALUES (
          ${examId},
          ${q.id},
          ${q.question_text || 'Question text missing'},
          ${q.question_type},
          ${optionA},
          ${optionB},
          ${optionC},
          ${optionD},
          ${optionE},
          ${correctAnswer},
          ${i + 1},
          ${q.timeAllocation || 60},
          ${q.points || 0},
          ${antiCheatExempt},
          NOW()
        )
      `

      // Store metadata in a separate field or extend quiz_questions table
      // For now, we'll add it to the question_bank_usage or create a metadata field
      // This will be read when fetching questions for the exam

      // Track question bank usage (if table exists)
      try {
        await sql`
          INSERT INTO question_bank_usage (quiz_id, bank_question_id)
          VALUES (${examId}, ${q.id})
          ON CONFLICT DO NOTHING
        `
      } catch (e) {
        // Table might not exist, skip tracking
        console.log(`[Final Exam Generator] Could not track question bank usage: ${e}`)
      }
    }

    // Assign to sessions
    for (const sessionCode of sessionCodes) {
      const resolved = await resolveSessionRowByCode(String(sessionCode ?? ""))
      if (resolved) {
        await sql`
          INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
          VALUES (${examId}, ${resolved.id}, true, CURRENT_TIMESTAMP)
          ON CONFLICT (quiz_id, session_id)
          DO UPDATE SET is_active = true, updated_at = CURRENT_TIMESTAMP
        `
      }
    }

    // Anti-cheat configuration is stored in question metadata, not in quizzes table
    // The session_access column doesn't exist, so we skip this update
    console.log(`[Final Exam Generator] Anti-cheat configured in question metadata`)

    console.log(`[Final Exam Generator] Exam created successfully with ID: ${examId}`)

    return NextResponse.json({
      success: true,
      examId,
      examConfig,
      summary: {
        totalQuestions: allQuestions.length,
        totalPoints: allQuestions.reduce((sum, q) => sum + q.points, 0),
        totalTimeMinutes: Math.round(totalTimeMinutes),
        mcqCount: mcqQuestions.length,
        cppCount: cppQuestions.length,
        matlabCount: matlabQuestions.length
      }
    })

  } catch (error: any) {
    console.error("[Final Exam Generator] Error:", error)
    return NextResponse.json(
      { error: "Failed to generate exam", details: error.message },
      { status: 500 }
    )
  }
}

