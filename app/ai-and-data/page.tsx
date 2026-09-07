import { LegalPage } from "@/components/compliance/LegalPage"
import { LegalDocumentArticle } from "@/components/compliance/LegalDocumentArticle"
import { getLegalDocument } from "@/lib/compliance/legal-content"

const document = getLegalDocument("ai-and-data")

export const metadata = {
  title: "AI & Data · CourseCollab",
  description: "How Cora processes prompts, course context, and stored conversations.",
}

export default function AiAndDataPage() {
  return (
    <LegalPage title={document.title} updated={document.updated}>
      <LegalDocumentArticle document={document} />
    </LegalPage>
  )
}
