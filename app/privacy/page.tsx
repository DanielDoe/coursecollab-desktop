import { LegalPage } from "@/components/compliance/LegalPage"
import { LegalDocumentArticle } from "@/components/compliance/LegalDocumentArticle"
import { getLegalDocument } from "@/lib/compliance/legal-content"

const document = getLegalDocument("privacy")

export const metadata = {
  title: "Privacy Policy · CourseCollab",
  description: "How CourseCollab collects, uses, and retains account and course data.",
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title={document.title} updated={document.updated}>
      <LegalDocumentArticle document={document} />
    </LegalPage>
  )
}
