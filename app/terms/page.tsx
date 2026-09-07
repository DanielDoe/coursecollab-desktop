import { LegalPage } from "@/components/compliance/LegalPage"
import { LegalDocumentArticle } from "@/components/compliance/LegalDocumentArticle"
import { getLegalDocument } from "@/lib/compliance/legal-content"

const document = getLegalDocument("terms")

export const metadata = {
  title: "Terms of Service · CourseCollab",
  description: "Terms for using CourseCollab web and mobile applications.",
}

export default function TermsOfServicePage() {
  return (
    <LegalPage title={document.title} updated={document.updated}>
      <LegalDocumentArticle document={document} />
    </LegalPage>
  )
}
