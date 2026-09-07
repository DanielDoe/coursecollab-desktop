import { QuizPreview } from "@/components/quiz-preview"

export default function PreviewQuizPage({ params }: { params: { id: string } }) {
  console.log("[v0] PreviewQuizPage rendering with params:", params)
  return <QuizPreview quizId={params.id} />
}
