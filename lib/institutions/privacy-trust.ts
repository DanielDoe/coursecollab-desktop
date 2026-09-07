import { LEGAL_PATHS } from "@/lib/compliance/legal"

export const INSTITUTION_PRIVACY_TRUST = {
  title: "Student data & AI privacy",
  summary:
    "CourseCollab is built for academic use. We do not sell or share student learning data with advertisers, data brokers, or unrelated third parties.",
  points: [
    {
      title: "No resale of student data",
      body: "Roster details, grades, submissions, and activity are not sold or licensed to third parties for marketing or analytics resale. Institution dashboards show aggregated metrics for your administrators only.",
    },
    {
      title: "Minimized AI processing",
      body: "Cora redacts or omits names, emails, student IDs, and other unnecessary identifiers before external AI calls. Providers receive only the instructional context needed for the task — not bulk exports of your database.",
    },
    {
      title: "Privacy controls by default",
      body: "Students and instructors manage Cora privacy preferences. Sharing AI summaries with instructors is off unless a user enables it. CourseCollab — not the AI provider — remains the system of record for academic data.",
    },
  ],
  links: [
    { href: LEGAL_PATHS.privacy, label: "Privacy Policy" },
    { href: LEGAL_PATHS.aiAndData, label: "AI & Data" },
  ],
} as const
