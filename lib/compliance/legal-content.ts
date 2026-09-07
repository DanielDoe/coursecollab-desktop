import { PRIVACY_INVENTORY, PRIVACY_NOT_COLLECTED } from "@/lib/compliance/privacy-inventory"
import type { LegalContentCatalog, LegalDocument, LegalDocumentId } from "@/lib/compliance/legal-content-types"

/** Bump when legal copy changes so mobile clients refresh cached documents. */
export const LEGAL_CONTENT_VERSION = "2026-08-18.1"

export const LEGAL_SUPPORT_EMAIL = "support@course-collab.com"

const LEGAL_UPDATED = "August 18, 2026"

function privacyPolicyDocument(): LegalDocument {
  return {
    id: "privacy",
    title: "Privacy Policy",
    updated: LEGAL_UPDATED,
    intro:
      "This policy describes the information CourseCollab processes in the web application, its APIs, and the native apps that call those APIs.",
    sections: [
      {
        title: "Who This Applies To",
        paragraphs: [
          "Students, teaching assistants, observers, faculty, administrators, and Career Member (guest) accounts.",
          "Institutional academic records may be retained after an account is closed because CourseCollab is used as a course of record.",
        ],
      },
      {
        title: "Information We Process",
        bullets: PRIVACY_INVENTORY.map(
          (item) =>
            `${item.label}: ${item.collected} Used for ${item.purpose.toLowerCase()} Stored in ${item.stored}${
              item.thirdParties.length > 0 ? ` Shared with ${item.thirdParties.join(", ")}.` : " Not sold to advertisers."
            }`,
        ),
      },
      {
        title: "What We Do Not Collect",
        bullets: [...PRIVACY_NOT_COLLECTED],
      },
      {
        title: "Cora AI",
        paragraphs: [
          "Cora is designed with data minimization in mind. When CourseCollab uses external artificial intelligence providers to process a request, we send only the information reasonably necessary to perform that task.",
          "For example, when generating feedback on a response, the AI service may receive the question, the response, and relevant instructional context without receiving the student's name, email address, student ID, or other unnecessary account information.",
          "CourseCollab does not intentionally provide an AI provider with a user's identity merely to personalize an AI response.",
          "Conversations and server-synced Cora privacy preferences are stored in CourseCollab so you can resume work and control personalization. Teaching-style memory toggles in Cora settings are stored locally on your device unless otherwise noted.",
          "Instructor sharing of Cora summaries is off unless you enable it. See AI & Data for provider details and controls.",
        ],
      },
      {
        title: "Payments",
        paragraphs: [
          "Memberships and Cora credit packs are processed by Stripe. CourseCollab stores customer and subscription references, not raw card numbers.",
        ],
      },
      {
        title: "Your Choices",
        paragraphs: [
          "Open Settings → Privacy & legal to review this policy, AI disclosures, and request account deletion.",
          "Deletion anonymizes personal profile fields and removes Cora conversations and push tokens.",
          "Grades, submissions, and payment records needed for institutional or financial obligations are retained.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [`Privacy questions: ${LEGAL_SUPPORT_EMAIL}`],
      },
    ],
  }
}

function termsDocument(): LegalDocument {
  return {
    id: "terms",
    title: "Terms of Service",
    updated: LEGAL_UPDATED,
    intro:
      "These terms apply to CourseCollab websites, APIs, and mobile applications. They are available without purchasing a membership.",
    sections: [
      {
        title: "Accounts",
        paragraphs: [
          "You must use accurate information and keep your password confidential.",
          "Faculty, student, teaching assistant, observer, administrator, and Career Member roles have different permissions.",
          "Changing a role in the app does not grant that role — the server decides access.",
        ],
      },
      {
        title: "Coursework and Acceptable Use",
        paragraphs: [
          "You may not use CourseCollab to cheat on assessments, access another person's records, attack the service, or upload unlawful content.",
          "Instructors remain responsible for official grades and course materials.",
        ],
      },
      {
        title: "Cora",
        paragraphs: [
          "Cora is an AI assistant. Its output can be wrong and is not a substitute for instructor guidance, official course documents, or professional advice.",
          "See the AI & Data disclosure for how prompts and course context are processed.",
        ],
      },
      {
        title: "Paid Features",
        paragraphs: [
          "Some memberships and Cora credit packs are paid. Web purchases currently use Stripe.",
          "Native iOS purchases, if offered inside the iOS app, must follow Apple's then-current In-App Purchase rules.",
          "Entitlements are granted only after CourseCollab verifies the purchase server-side.",
        ],
      },
      {
        title: "Institutional Records",
        paragraphs: [
          "If you are enrolled in a course, your instructor and institution may retain academic records after you close your personal account.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [LEGAL_SUPPORT_EMAIL],
      },
    ],
  }
}

function supportDocument(): LegalDocument {
  return {
    id: "support",
    title: "Support",
    updated: LEGAL_UPDATED,
    intro:
      "CourseCollab support is available for policy questions without signing in, and for in-app help when you are signed in.",
    sections: [
      {
        title: "Get Help",
        bullets: [
          "Students: open Help Center from Settings after signing in.",
          "Faculty: open Help Center from the instructor dashboard or Settings.",
          "Career Members: use Help Center from guest Settings.",
        ],
      },
      {
        title: "Submit a Ticket",
        paragraphs: [
          "Signed-in users can submit support tickets, report bugs, and request features from Help Center in the app.",
        ],
      },
      {
        title: "Account and Privacy",
        paragraphs: [
          "Privacy Policy, Terms of Service, and AI & Data are available under Settings → Privacy & legal.",
          "Account deletion is available from the same screen when you are signed in.",
        ],
      },
      {
        title: "Contact",
        paragraphs: [`Email ${LEGAL_SUPPORT_EMAIL} for App Store review or institutional onboarding questions.`],
      },
    ],
  }
}

function aiAndDataDocument(): LegalDocument {
  return {
    id: "ai-and-data",
    title: "AI & Data",
    updated: LEGAL_UPDATED,
    intro:
      "Cora is CourseCollab's AI layer. This describes what the current implementation does — including data minimization before external model calls.",
    sections: [
      {
        title: "What Cora Processes",
        bullets: [
          "Your message and recent conversation turns.",
          "Task-specific course context you are authorized to see (for example a question, your answer, and rubric text for feedback).",
          "Optional server-synced personalization toggles (Personalized learning, Use learning context) from Settings → Cora → Privacy & personalization.",
          "Device-local teaching memory toggles stored in your browser or app storage — not the same as chat history on CourseCollab servers.",
          "Uploaded files you attach to a disclosed workflow, such as a résumé in Career tools or audio for AI Notetaker transcription.",
        ],
      },
      {
        title: "Data Minimization",
        paragraphs: [
          "Before an external AI call, CourseCollab selects authorized data, removes or redacts common identifiers (names, emails, student IDs, internal database IDs, tokens, and unrelated profile fields), and sends a minimized payload.",
          "Cora tools may read authorized records internally to perform a task, but tool authorization is separate from model context — retrieved roster or account details are not automatically forwarded to the model.",
          "We do not serialize entire Student, Faculty, Course, or User database objects into prompts.",
        ],
      },
      {
        title: "Who Runs the Models",
        paragraphs: [
          "Cora calls third-party AI providers — currently OpenAI and/or Anthropic — using server-side API keys. These are commercial model APIs, not self-hosted open-source platforms unless we explicitly say otherwise for a specific feature.",
          "Provider retention and subprocessors follow each provider's published terms. CourseCollab remains the authoritative store for profiles, grades, enrollment, permissions, and academic records — not the AI provider.",
        ],
      },
      {
        title: "What Is Stored",
        paragraphs: [
          "Conversations, credit usage, and server-synced Cora privacy preferences are stored in CourseCollab Postgres.",
          "Teaching-style Cora memory toggles and cleared-memory choices are stored locally on your device.",
          "Instructor sharing of Cora summaries is off unless you turn it on in Cora preferences.",
        ],
      },
      {
        title: "Your Controls",
        bullets: [
          "Settings → Cora → Privacy & personalization: Personalized learning, Use learning context, Local learning memory, Clear Cora learning memory.",
          "Share Cora summaries with instructor (off by default).",
          "Delete account from Settings → Privacy & legal to remove Cora conversations tied to your profile (subject to institutional record retention).",
        ],
      },
      {
        title: "AI Notetaker",
        paragraphs: [
          "AI Notetaker sends your question and the lecture transcript (or caption text) needed to answer it. Account identifiers are not added to the prompt for personalization alone.",
          "Transcripts and notes are stored in CourseCollab; processing may use the same third-party AI providers as Cora.",
        ],
      },
      {
        title: "Faculty and Admin Cora",
        paragraphs: [
          "Faculty and administrator Cora assistants follow the same minimization approach: aggregated or pseudonymized context when identity is unnecessary, and no bulk roster of student names or emails in external model payloads.",
        ],
      },
      {
        title: "What Cora Must Not Do",
        paragraphs: [
          "Cora inherits your signed-in role. A student assistant cannot retrieve unpublished exams, answer keys, another student's work, or admin tools.",
          "Tool permissions are enforced in application code before protected records are retrieved — not only by the system prompt.",
        ],
      },
      {
        title: "Accuracy",
        paragraphs: [
          "Cora output can contain errors. Treat it as study help, not as an official grade, answer key, or university record.",
        ],
      },
    ],
  }
}

const DOCUMENT_BUILDERS: Record<LegalDocumentId, () => LegalDocument> = {
  privacy: privacyPolicyDocument,
  terms: termsDocument,
  support: supportDocument,
  "ai-and-data": aiAndDataDocument,
}

export const LEGAL_DOCUMENT_IDS = Object.keys(DOCUMENT_BUILDERS) as LegalDocumentId[]

export function isLegalDocumentId(value: string): value is LegalDocumentId {
  return LEGAL_DOCUMENT_IDS.includes(value as LegalDocumentId)
}

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  return DOCUMENT_BUILDERS[id]()
}

export function getLegalContentCatalog(): LegalContentCatalog {
  const documents = LEGAL_DOCUMENT_IDS.reduce(
    (acc, id) => {
      acc[id] = getLegalDocument(id)
      return acc
    },
    {} as Record<LegalDocumentId, LegalDocument>,
  )

  return {
    version: LEGAL_CONTENT_VERSION,
    updated: LEGAL_UPDATED,
    documents,
  }
}
