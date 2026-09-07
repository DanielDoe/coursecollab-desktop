// Lecture Module Types

export interface LectureQuiz {
  question: string
  options: string[]
  answer: string
  explanation?: string
}

export interface LectureSlide {
  id?: string
  heading: string
  content: string
  code?: string
  codeLanguage?: string
  image?: string
  video?: string
  quiz?: LectureQuiz
  type?: 'content' | 'code' | 'quiz' | 'media' | 'challenge'
  duration?: number // estimated time in seconds
}

export interface LectureData {
  id?: number
  title: string
  week: number
  description?: string
  objectives: string[]
  slides: LectureSlide[]
  instructor_id?: number
  session_access?: Record<string, boolean>
  created_at?: string
  updated_at?: string
  is_active?: boolean
  total_xp?: number
}

export interface LectureProgress {
  id?: number
  student_id: number
  lecture_id: number
  current_slide: number
  completed_slides: number[]
  quiz_scores: Record<number, boolean>
  notes: Record<number, string>
  xp_earned: number
  completed_at?: string
  last_accessed?: string
}

export interface LectureNote {
  slide_index: number
  content: string
  ai_summary?: string
  created_at: string
}

export interface AILectureContext {
  lecture_title: string
  current_slide: LectureSlide
  previous_slides: LectureSlide[]
  student_progress: LectureProgress
}


