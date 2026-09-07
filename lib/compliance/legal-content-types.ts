export type LegalDocumentId = "privacy" | "terms" | "support" | "ai-and-data"

export type LegalSection = {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export type LegalDocument = {
  id: LegalDocumentId
  title: string
  updated: string
  intro?: string
  sections: LegalSection[]
}

export type LegalContentCatalog = {
  version: string
  updated: string
  documents: Record<LegalDocumentId, LegalDocument>
}
