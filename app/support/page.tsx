import { LegalPage } from "@/components/compliance/LegalPage"
import { LegalDocumentArticle } from "@/components/compliance/LegalDocumentArticle"
import { getLegalDocument } from "@/lib/compliance/legal-content"

const document = getLegalDocument("support")

export const metadata = {
  title: "Support · CourseCollab",
  description: "Help, contact, and account support for CourseCollab.",
}

export default function SupportPage() {
  return (
    <LegalPage title={document.title} updated={document.updated}>
      <LegalDocumentArticle document={document} />
    </LegalPage>
  )
}
