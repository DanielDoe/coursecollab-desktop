import type { LegalDocument } from "@/lib/compliance/legal-content-types"
import { LEGAL_SUPPORT_EMAIL } from "@/lib/compliance/legal-content"

function renderParagraph(text: string) {
  if (text.includes(LEGAL_SUPPORT_EMAIL)) {
    const [before, after] = text.split(LEGAL_SUPPORT_EMAIL)
    return (
      <p>
        {before}
        <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>{LEGAL_SUPPORT_EMAIL}</a>
        {after}
      </p>
    )
  }
  return <p>{text}</p>
}

export function LegalDocumentArticle({ document }: { document: LegalDocument }) {
  return (
    <>
      {document.intro ? <p>{document.intro}</p> : null}
      {document.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph, index) => (
            <span key={`${section.title}-p-${index}`}>{renderParagraph(paragraph)}</span>
          ))}
          {section.bullets?.length ? (
            <ul>
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  )
}
