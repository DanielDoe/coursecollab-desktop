import { EditQuestionForm } from "@/components/edit-question-form"

export default function EditQuestionPage({ params }: { params: { id: string } }) {
  return <EditQuestionForm questionId={params.id} />
}
