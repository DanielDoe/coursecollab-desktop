import {
  hasActiveQuestionMedia,
  resolveQuestionMedia,
  type QuestionMedia,
} from "@/lib/question-media"
import type { CoraProblemContext } from "@/lib/cora/types"

export function attachMediaToProblem(
  problem: CoraProblemContext,
  sources: {
    question_media?: unknown
    circuit_spec?: unknown
    bank_question_media?: unknown
  },
): CoraProblemContext {
  const media = resolveQuestionMedia(sources)
  if (!hasActiveQuestionMedia(media)) return problem
  return {
    ...problem,
    mediaUrl: problem.mediaUrl ?? media.media_url ?? null,
    questionMedia: media,
  }
}

export function mediaSourcesFromProblem(problem: CoraProblemContext): {
  question_media?: unknown
} {
  if (problem.questionMedia) {
    return { question_media: problem.questionMedia }
  }
  if (problem.mediaUrl) {
    return {
      question_media: {
        media_enabled: true,
        media_url: problem.mediaUrl,
      } satisfies QuestionMedia,
    }
  }
  return {}
}
