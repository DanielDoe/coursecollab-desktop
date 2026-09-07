import { QuizPreview } from "@/components/quiz-preview"

export default function PreviewMidSemesterPage({ params }: { params: { id: string } }) {
  return <QuizPreview quizId={params.id} />
}
