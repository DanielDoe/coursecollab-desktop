/**
 * Local Answer Verification Utility
 * 
 * Verifies MCQ, True/False, Select All, and Fill-in-the-Blank questions locally
 * without requiring internet connectivity. This improves reliability and reduces
 * dependency on network calls for simple question types.
 */

import {
  scoreSelectAllQuestion,
} from "@/lib/select-all-scoring"
import { normalizeCorrectAnswerToLetter } from "@/lib/question-bank-normalize"
import { parseStudentAnswerForVerify } from "@/lib/assessment-verify-payload"
import { parseCircuitSpec } from "@/lib/engineering-circuit-types"
import {
  verifyCircuitFillEquation,
  verifyCircuitMultiPart,
  verifyCircuitNumeric,
} from "@/lib/circuit-answer-grading"

export interface VerificationResult {
  isCorrect: boolean
  score: number
  feedback: string
  requiresAI: boolean
}

/**
 * Normalize answer for comparison
 */
function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]/g, '')
}

function isOptionLetterToken(value: string): boolean {
  const normalized = normalizeAnswer(value)
  return normalized.length <= 2 && /^[a-f]$/.test(normalized)
}

function availableOptionLetters(options: Record<string, string | null | undefined>): Set<string> {
  const letters = new Set<string>()
  for (const letter of ["A", "B", "C", "D", "E"]) {
    const text = options[letter as keyof typeof options]
    if (text != null && String(text).trim() !== "") {
      letters.add(letter.toLowerCase())
    }
  }
  return letters
}

function filterCorrectLettersToAvailableOptions(
  answers: string[],
  options: Record<string, string | null | undefined>,
): string[] {
  const available = availableOptionLetters(options)
  return answers.filter((ans) => {
    const normalized = normalizeAnswer(String(ans))
    if (isOptionLetterToken(normalized)) return available.has(normalized)
    return true
  })
}

/**
 * Parse correct_answer from DB - handles JSONB, array, number (0-based index), object, null
 */
function parseCorrectAnswer(raw: unknown, _options?: Record<string, string>): string {
  if (raw == null || raw === '') return ''
  let value: unknown = raw
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) && parsed.length > 0) {
        value = parsed[0]
      } else if (typeof parsed === 'string' || typeof parsed === 'number') {
        value = parsed
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        value = (parsed as Record<string, unknown>).answer ?? (parsed as Record<string, unknown>).correct ?? (parsed as Record<string, unknown>).value
      }
    } catch {
      // Not JSON, use as-is
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    value = obj.answer ?? obj.correct ?? obj.value ?? obj[0]
  }
  if (typeof value === 'number') {
    const letters = ['a', 'b', 'c', 'd', 'e']
    const idx = Math.floor(value)
    if (idx >= 0 && idx < letters.length) return letters[idx]
    return String(value)
  }
  return String(value ?? '').trim()
}

type OptionMap = Record<string, string | null | undefined>

function optionTextsFromMap(options: OptionMap): string[] {
  return ["A", "B", "C", "D", "E"]
    .map((letter) => options[letter])
    .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
}

/** Resolve stored correct_answer (letter, text, True/False, index) to a lowercase option letter. */
function resolveCorrectToOptionLetter(
  rawCorrect: unknown,
  options: OptionMap,
  questionType?: string,
): string {
  const optionTexts = optionTextsFromMap(options)
  const fromNormalizer = normalizeCorrectAnswerToLetter(rawCorrect, optionTexts, questionType)
  const normalizedLetter = normalizeAnswer(fromNormalizer)
  if (/^[a-e]$/.test(normalizedLetter)) return normalizedLetter

  const parsed = parseCorrectAnswer(rawCorrect, options as Record<string, string>)
  const normalized = normalizeAnswer(parsed)
  if (/^[a-e]$/.test(normalized)) return normalized

  for (const [letter, text] of Object.entries(options)) {
    if (text && normalizeAnswer(String(text)) === normalized) {
      return letter.toLowerCase()
    }
  }

  const qType = (questionType ?? "").toLowerCase().replace(/[_-]/g, "")
  if (qType === "truefalse" || qType === "tf" || qType === "boolean") {
    if (normalized === "true" || normalized === "t") return "a"
    if (normalized === "false" || normalized === "f") return "b"
  }

  return normalized
}

/** Map a student answer (letter or option text) to a lowercase option letter when possible. */
function resolveStudentToOptionLetter(studentAnswer: string, options: OptionMap): string {
  const normalizedStudent = normalizeAnswer(studentAnswer)
  let effectiveStudent = normalizedStudent
  const letterPrefixMatch = normalizedStudent.match(/^([a-e])\s+/)
  if (letterPrefixMatch) {
    effectiveStudent = letterPrefixMatch[1]
  }
  if (/^[a-e]$/.test(effectiveStudent)) return effectiveStudent

  for (const [letter, text] of Object.entries(options)) {
    if (text && normalizeAnswer(String(text)) === normalizedStudent) {
      return letter.toLowerCase()
    }
  }

  const trueValues = ["true", "t", "yes", "y", "1"]
  const falseValues = ["false", "f", "no", "n", "0"]
  const optionAText = normalizeAnswer(options.A || "")
  const optionBText = normalizeAnswer(options.B || "")

  if (trueValues.includes(normalizedStudent)) {
    if (optionAText.includes("true") || optionAText === "true") return "a"
    if (optionBText.includes("true") || optionBText === "true") return "b"
    return "a"
  }
  if (falseValues.includes(normalizedStudent)) {
    if (optionAText.includes("false") || optionAText === "false") return "a"
    if (optionBText.includes("false") || optionBText === "false") return "b"
    return "b"
  }

  return effectiveStudent
}

/**
 * Verify MCQ (Multiple Choice Question)
 */
function verifyMCQ(studentAnswer: string, questionData: any): VerificationResult {
  const rawCorrect = questionData.correctAnswer
  const options = questionData.options || {}
  const correctAnswer = parseCorrectAnswer(rawCorrect, options)

  if (!correctAnswer) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "❌ No correct answer configured for this question.",
      requiresAI: false
    }
  }
  
  const normalizedStudent = normalizeAnswer(studentAnswer)
  const normalizedCorrect = normalizeAnswer(correctAnswer)
  
  // Handle "A Option text" format - letter followed by option text (e.g. "A True", "B High-level")
  let effectiveStudent = normalizedStudent
  const letterPrefixMatch = normalizedStudent.match(/^([a-e])\s+/)
  if (letterPrefixMatch) {
    effectiveStudent = letterPrefixMatch[1]
  }
  
  if (DEBUG_VERIFY) {
    console.log(`    [verifyMCQ] raw="${studentAnswer}" normalized="${normalizedStudent}" effective="${effectiveStudent}" correct="${normalizedCorrect}" letterPrefixMatch=${!!letterPrefixMatch}`)
  }
  
  // Student might answer with:
  // 1. Option letter: "A", "B", "C", etc.
  // 2. Full option text: "A self-contained set of instructions..."
  
  // Check if student answered with option letter
  if (effectiveStudent.length <= 2 && ['a', 'b', 'c', 'd', 'e'].includes(effectiveStudent)) {
    const studentLetter = effectiveStudent.toLowerCase().trim()
    const correctLetter = resolveCorrectToOptionLetter(rawCorrect, options, "mcq")
    const isCorrect = studentLetter === correctLetter
    if (DEBUG_VERIFY) {
      console.log(`    [verifyMCQ] letter comparison: studentLetter="${studentLetter}" correctLetter="${correctLetter}" isCorrect=${isCorrect}`)
    }
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect 
        ? "✅ Correct! Well done." 
        : `❌ Incorrect. The correct answer is: ${correctAnswer}`,
      requiresAI: false
    }
  }
  
  // Student answered with full option text - need to find which option it matches
  let matchedOption = ''
  for (const [letter, text] of Object.entries(options)) {
    if (text) {
      const normalizedOptionText = normalizeAnswer(String(text))
      if (normalizedOptionText === normalizedStudent) {
        matchedOption = letter.toLowerCase()
        break
      }
    }
  }
  
  if (!matchedOption) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "❌ Could not verify answer format.",
      requiresAI: false
    }
  }
  
  // Ensure case-insensitive comparison for option letters
  const normalizedMatchedOption = matchedOption.toLowerCase().trim()
  const correctLetter = resolveCorrectToOptionLetter(rawCorrect, options, "mcq")
  const isCorrect = normalizedMatchedOption === correctLetter && correctLetter !== ""
  
  return {
    isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect 
      ? "✅ Correct! Well done." 
      : `❌ Incorrect. The correct answer is: ${correctAnswer}`,
    requiresAI: false
  }
}

/**
 * Verify True/False Question
 */
function verifyTrueFalse(studentAnswer: string, questionData: any): VerificationResult {
  const rawCorrect = questionData.correctAnswer
  const options = questionData.options || {}
  const correctAnswer = parseCorrectAnswer(rawCorrect, options)

  if (!correctAnswer) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "❌ No correct answer configured for this question.",
      requiresAI: false
    }
  }
  
  const normalizedStudent = normalizeAnswer(studentAnswer)
  const normalizedCorrect = normalizeAnswer(correctAnswer)
  
  // Handle "A True" / "A False" format - letter followed by option text (e.g. from results display)
  // Extract the letter when student answer is "a true", "a false", "b true", "b false"
  let effectiveStudent = normalizedStudent
  const letterPrefixMatch = normalizedStudent.match(/^([ab])\s+/)
  if (letterPrefixMatch) {
    effectiveStudent = letterPrefixMatch[1]
  }
  
  if (DEBUG_VERIFY) {
    console.log(`    [verifyTrueFalse] raw="${studentAnswer}" normalized="${normalizedStudent}" effective="${effectiveStudent}" correct="${normalizedCorrect}" letterPrefixMatch=${!!letterPrefixMatch}`)
  }

  const correctLetter = resolveCorrectToOptionLetter(rawCorrect, options, "true_false")
  const studentLetter = resolveStudentToOptionLetter(studentAnswer, options)

  if (/^[ab]$/.test(correctLetter) && /^[ab]$/.test(studentLetter)) {
    const isCorrect = studentLetter === correctLetter
    if (DEBUG_VERIFY) {
      console.log(`    [verifyTrueFalse] letter comparison: studentLetter="${studentLetter}" correctLetter="${correctLetter}" isCorrect=${isCorrect}`)
    }
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect
        ? "✅ Correct! Well done."
        : `❌ Incorrect. The correct answer is: ${options[correctLetter.toUpperCase()] || correctAnswer}`,
      requiresAI: false,
    }
  }

  // Legacy path: correct answer stored as option letter (A or B) with True/False text answers
  if (['a', 'b'].includes(normalizedCorrect)) {
    // Database stores option letter, student might answer "True" or "False"
    // Need to check which option corresponds to True/False
    
    // Handle various true/false formats from student
    const trueValues = ['true', 't', 'yes', 'y', '1', 'a']
    const falseValues = ['false', 'f', 'no', 'n', '0', 'b']
    
    // If student answered with option letter (or "A True" -> "a"), compare directly
    if (['a', 'b'].includes(effectiveStudent)) {
      const studentLetter = effectiveStudent.toLowerCase().trim()
      const correctLetter = normalizedCorrect.toLowerCase().trim()
      const isCorrect = studentLetter === correctLetter
      if (DEBUG_VERIFY) {
        console.log(`    [verifyTrueFalse] letter comparison: studentLetter="${studentLetter}" correctLetter="${correctLetter}" isCorrect=${isCorrect}`)
      }
      return {
        isCorrect,
        score: isCorrect ? 100 : 0,
        feedback: isCorrect 
          ? "✅ Correct! Well done." 
          : `❌ Incorrect. The correct answer is: ${options[correctAnswer.toUpperCase()] || correctAnswer}`,
        requiresAI: false
      }
    }
    
    // If student answered True/False, need to map to option
    // Typically: A = True, B = False (but check options text)
    const optionAText = normalizeAnswer(options.A || '')
    const optionBText = normalizeAnswer(options.B || '')
    
    let studentAsOption = ''
    if (trueValues.includes(normalizedStudent)) {
      // Student said True - check which option is True
      if (optionAText.includes('true') || optionAText === 'true') {
        studentAsOption = 'a'
      } else if (optionBText.includes('true') || optionBText === 'true') {
        studentAsOption = 'b'
      } else {
        // Default: A = True
        studentAsOption = 'a'
      }
    } else if (falseValues.includes(normalizedStudent)) {
      // Student said False - check which option is False
      if (optionAText.includes('false') || optionAText === 'false') {
        studentAsOption = 'a'
      } else if (optionBText.includes('false') || optionBText === 'false') {
        studentAsOption = 'b'
      } else {
        // Default: B = False
        studentAsOption = 'b'
      }
    }
    
    // Check if correct answer is a letter or text
    const correctIsLetter = /^[a-b]$/i.test(normalizedCorrect)
    
    let isCorrect = false
    if (correctIsLetter) {
      // Correct answer is a letter - compare with student's option letter
      isCorrect = studentAsOption === normalizedCorrect
    } else {
      // Correct answer is text - need to find which option it matches
      const optionATextForCorrect = normalizeAnswer(options.A || '')
      const optionBTextForCorrect = normalizeAnswer(options.B || '')
      
      let correctAsOption = ''
      if (normalizedCorrect.includes('true') || normalizedCorrect === 'true') {
        if (optionATextForCorrect.includes('true') || optionATextForCorrect === 'true') {
          correctAsOption = 'a'
        } else if (optionBTextForCorrect.includes('true') || optionBTextForCorrect === 'true') {
          correctAsOption = 'b'
        } else {
          correctAsOption = 'a' // Default: A = True
        }
      } else if (normalizedCorrect.includes('false') || normalizedCorrect === 'false') {
        if (optionATextForCorrect.includes('false') || optionATextForCorrect === 'false') {
          correctAsOption = 'a'
        } else if (optionBTextForCorrect.includes('false') || optionBTextForCorrect === 'false') {
          correctAsOption = 'b'
        } else {
          correctAsOption = 'b' // Default: B = False
        }
      }
      
      // Compare student's option letter with correct answer's option letter
      isCorrect = studentAsOption === correctAsOption && correctAsOption !== ''
    }
    
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect 
        ? "✅ Correct! Well done." 
        : `❌ Incorrect. The correct answer is: ${options[correctAnswer.toUpperCase()] || correctAnswer}`,
      requiresAI: false
    }
  }
  
  // Direct comparison if not option letters - ensure case-insensitive
  // Handle case where correct answer might be "True" and student answer is "TRUE" or vice versa
  const studentLower = normalizedStudent.toLowerCase().trim()
  const correctLower = normalizedCorrect.toLowerCase().trim()
  const isCorrect = studentLower === correctLower
  
  return {
    isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect 
      ? "✅ Correct! Well done." 
      : `❌ Incorrect. The correct answer is: ${correctAnswer}`,
    requiresAI: false
  }
}

/**
 * Verify Select All Question
 */
function verifySelectAll(studentAnswers: string[], questionData: any): VerificationResult {
  const options = questionData.options || {}
  
  // Get correct answers - could be array, JSON string, or single value
  let correctAnswers = questionData.correctAnswer
  if (correctAnswers == null) correctAnswers = []
  if (typeof correctAnswers === 'string') {
    try {
      const parsed = JSON.parse(correctAnswers)
      correctAnswers = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      if (correctAnswers.includes(',')) {
        correctAnswers = correctAnswers.split(',').map((a: string) => a.trim()).filter(Boolean)
      } else {
        correctAnswers = [correctAnswers]
      }
    }
  }
  if (!Array.isArray(correctAnswers)) {
    correctAnswers = [correctAnswers]
  }
  // Ensure all are strings; handle numeric indices (0->A, 1->B)
  correctAnswers = correctAnswers.map((a: unknown) => {
    if (typeof a === 'number') {
      const letters = ['A', 'B', 'C', 'D', 'E']
      return letters[Math.floor(a)] ?? String(a)
    }
    return String(a ?? '').trim()
  }).filter(Boolean)
  
  // Determine if correct answers are letters (e.g., ["A","C"]) or values (e.g., ["myVariable", "class_name"])
  const correctAnswersAreLetter = correctAnswers.every((ans) => isOptionLetterToken(String(ans)))

  // Determine if student answers are letters
  const studentAnswersAreLetter = studentAnswers.every((ans) => isOptionLetterToken(String(ans)))

  if (correctAnswersAreLetter) {
    correctAnswers = filterCorrectLettersToAvailableOptions(correctAnswers, options)
  }
  
  // Convert student answers to the same format as correct answers
  let studentNormalized: string[]
  let correctNormalized: string[]
  
  if (correctAnswersAreLetter) {
    // Quiz format: correct answers are letters ["A","C"]
    // Convert student answers (which might be full text) to letters
    studentNormalized = studentAnswers.map((studentAns) => {
      const normalized = normalizeAnswer(String(studentAns))
      
      // Check if already a letter
      if (isOptionLetterToken(normalized)) {
        return normalized.toLowerCase()
      }
      
      // Find matching option by text
      for (const [letter, text] of Object.entries(options)) {
        if (text) {
          const normalizedOptionText = normalizeAnswer(String(text))
          if (normalizedOptionText === normalized) {
            return letter.toLowerCase()
          }
        }
      }
      
      return normalized.toLowerCase() // Return as-is if no match, but lowercase
    }).filter(Boolean).sort()
    
    correctNormalized = correctAnswers
      .map((a) => {
        const normalized = normalizeAnswer(String(a))
        if (isOptionLetterToken(normalized)) return normalized.toLowerCase()
        return normalized.toLowerCase()
      })
      .filter(Boolean)
      .sort()
  } else {
    // Question bank format: correct answers are values ["myVariable", "class_name"]
    // CRITICAL: If student answers are letters, convert them to option text first
    if (studentAnswersAreLetter) {
      studentNormalized = studentAnswers.map((studentAns) => {
        const normalized = normalizeAnswer(String(studentAns))
        
        // Convert letter to option text
        if (isOptionLetterToken(normalized)) {
          const letter = normalized.toUpperCase()
          const optionText = options[letter as keyof typeof options]
          if (optionText) {
            return normalizeAnswer(String(optionText))
          }
        }
        
        return normalized
      }).filter(Boolean).sort()
    } else {
      // Student answers are already text values
      studentNormalized = studentAnswers.map(ans => normalizeAnswer(String(ans))).filter(Boolean).sort()
    }
    
    // Normalize correct answers as values
    correctNormalized = correctAnswers.map(ans => normalizeAnswer(String(ans))).filter(Boolean).sort()
  }
  
  const correctUniq = [...new Set(correctNormalized)]
  const studentUniq = [...new Set(studentNormalized)]

  const scored = scoreSelectAllQuestion(studentUniq, correctUniq, 100)
  const { correctSelected: c, incorrectSelected: i, correctCount: t } = scored
  const score = scored.points
  const isCorrect = scored.isFullyCorrect

  const missed = t - c

  let feedback = ""
  if (isCorrect) {
    feedback = "✅ Correct! You selected all the right answers and no incorrect ones."
  } else if (t === 0) {
    feedback = "❌ No correct answers configured for this question."
  } else {
    feedback = `Partial credit (${score.toFixed(0)}%). Score = max(0, (C−I)/T) with C=${c} correct selected, I=${i} incorrect selected, T=${t} total correct answers.`
    if (studentUniq.length === 0) {
      feedback = "No options selected — score 0."
    } else if (c === 0 && i > 0) {
      feedback = `Incorrect selections only (score 0). T=${t} correct answer(s) on this question.`
    } else if (missed > 0 && i === 0) {
      feedback += ` You missed ${missed} correct answer(s).`
    }
  }

  return {
    isCorrect,
    score,
    feedback,
    requiresAI: false,
  }
}

/**
 * Verify Fill in the Blank Question
 */
function verifyFillBlank(studentAnswer: string, questionData: any): VerificationResult {
  const normalizedStudent = normalizeAnswer(studentAnswer)
  
  // Get correct answer(s) - could be array, JSON string, or plain string
  let correctAnswer = questionData.correctAnswer
  
  // If it's a JSON string, parse it
  if (typeof correctAnswer === 'string') {
    try {
      const parsed = JSON.parse(correctAnswer)
      if (Array.isArray(parsed)) {
        correctAnswer = parsed
      }
    } catch {
      // Not JSON, keep as string
    }
  }
  
  // Handle multiple acceptable answers
  const acceptableAnswers = Array.isArray(correctAnswer) 
    ? correctAnswer.map(a => normalizeAnswer(String(a)))
    : [normalizeAnswer(String(correctAnswer))]
  
  const isCorrect = acceptableAnswers.some(answer => {
    // Exact match
    if (normalizedStudent === answer) return true
    
    // Contains match (for partial answers)
    if (answer.includes(normalizedStudent) || normalizedStudent.includes(answer)) {
      return normalizedStudent.length >= answer.length * 0.8 // 80% similarity
    }
    
    return false
  })
  
  // Calculate similarity score for partial credit
  let maxSimilarity = 0
  acceptableAnswers.forEach(answer => {
    const similarity = calculateSimilarity(normalizedStudent, answer)
    maxSimilarity = Math.max(maxSimilarity, similarity)
  })
  
  const score = isCorrect ? 100 : Math.round(maxSimilarity * 100)
  
  let feedback = ""
  if (isCorrect) {
    feedback = "✅ Correct! Well done."
  } else if (score >= 50) {
    feedback = `⚠️ Partially correct (${score}%). Your answer is close but not exact.`
  } else {
    const displayAnswer = Array.isArray(correctAnswer) 
      ? correctAnswer.join(" or ")
      : correctAnswer
    feedback = `❌ Incorrect. Expected: ${displayAnswer}`
  }
  
  return {
    isCorrect,
    score,
    feedback,
    requiresAI: false
  }
}

/**
 * Calculate string similarity (Levenshtein distance based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

/** Set to true to log comparison details in terminal (for debugging re-evaluation) */
const DEBUG_VERIFY = process.env.NODE_ENV === "development"

/**
 * Main verification function - routes to appropriate verifier
 */
export function verifyAnswerLocally(
  questionType: string,
  studentAnswer: any,
  questionData: any
): VerificationResult {
  const normalizedType = questionType.toLowerCase().replace(/[_-]/g, '')
  const parsedStudentAnswer = parseStudentAnswerForVerify(questionType, studentAnswer)
  
  if (DEBUG_VERIFY) {
    console.log(`  [verifyAnswerLocally] type=${normalizedType} studentAnswer=${JSON.stringify(studentAnswer)} parsed=${JSON.stringify(parsedStudentAnswer)} correctAnswer=${JSON.stringify(questionData?.correctAnswer)}`)
  }
  
  // Local verification for non-AI question types
  
  try {
    switch (normalizedType) {
      case 'mcq':
      case 'multiplechoice':
        return verifyMCQ(String(parsedStudentAnswer), questionData)
      
      case 'truefalse':
      case 'tf':
      case 'boolean':
        return verifyTrueFalse(String(parsedStudentAnswer), questionData)
      
      case 'selectall':
      case 'multipleselect':
      case 'checkbox':
      case 'multioutput':
        const studentArr = Array.isArray(parsedStudentAnswer)
          ? parsedStudentAnswer
          : [parsedStudentAnswer]
        return verifySelectAll(studentArr, questionData)
      
      case 'fillblank':
      case 'fillintheblank':
      case 'shortanswer':
      case 'fillcode':
      case 'tracelogic':
      case 'traceoutput':
      case 'codeoutput':
        return verifyFillBlank(String(parsedStudentAnswer), questionData)

      case 'circuitnumeric':
        return verifyCircuitNumeric(parsedStudentAnswer, parseCircuitSpec(questionData?.circuitSpec))

      case 'circuitfillequation':
        return verifyCircuitFillEquation(parsedStudentAnswer, parseCircuitSpec(questionData?.circuitSpec))

      case 'circuitmultipart':
        return verifyCircuitMultiPart(parsedStudentAnswer, parseCircuitSpec(questionData?.circuitSpec))
      
      default:
        // Question type requires AI evaluation
        return {
          isCorrect: false,
          score: 0,
          feedback: "This question requires AI evaluation.",
          requiresAI: true
        }
    }
  } catch (error) {
    console.error("[Local Verify] Error:", error)
    // Fallback to AI if local verification fails
    return {
      isCorrect: false,
      score: 0,
      feedback: "Verification failed. Will use AI evaluation.",
      requiresAI: true
    }
  }
}

/**
 * Check if a question type can be verified locally
 */
export function canVerifyLocally(questionType: string): boolean {
  const localTypes = [
    'mcq', 'multiplechoice',
    'truefalse', 'tf', 'boolean',
    'selectall', 'multipleselect', 'checkbox', 'multioutput',
    'fillblank', 'fillintheblank', 'shortanswer',
    'fillcode', 'tracelogic', 'traceoutput', 'codeoutput',
    'circuitnumeric', 'circuitfillequation', 'circuitmultipart',
  ]
  
  const normalizedType = questionType.toLowerCase().replace(/[_-]/g, '')
  return localTypes.includes(normalizedType)
}

