import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CircleHelp,
  CreditCard,
  Database,
  FlaskConical,
  GitBranch,
  GraduationCap,
  MessageSquare,
  Layers,
  LineChart,
  Scale,
  Shield,
  Sparkles,
  Target,
  Users,
} from "lucide-react"
import type { FacultySideMenuItem } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import type { AnalyticsTab } from "@/lib/institutions/metrics/types"

export type InstitutionAnalyticsSection =
  | "overview"
  | "engagement"
  | "learning"
  | "ai_assistance"
  | "independent"
  | "cognitive"
  | "assessment"
  | "interventions"
  | "student_success"
  | "equity"
  | "courses"
  | "faculty"
  | "adoption"
  | "research"
  | "feedback"
  | "data_quality"
  | "longitudinal"
  | "pathways"
  | "questions"

const LEGACY_SECTION: Record<string, InstitutionAnalyticsSection> = {
  outcomes: "learning",
  cora: "ai_assistance",
  utilization: "adoption",
}

export const INSTITUTION_ANALYTICS_SECTIONS: InstitutionAnalyticsSection[] = [
  "overview",
  "questions",
  "engagement",
  "learning",
  "ai_assistance",
  "independent",
  "cognitive",
  "assessment",
  "interventions",
  "student_success",
  "equity",
  "courses",
  "faculty",
  "adoption",
  "research",
  "feedback",
  "longitudinal",
  "pathways",
  "data_quality",
]

export const INSTITUTION_ANALYTICS_MENU: FacultySideMenuItem[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "questions", label: "Research Questions", icon: CircleHelp },
  { id: "engagement", label: "Engagement", icon: Users },
  { id: "learning", label: "Learning", icon: LineChart },
  { id: "ai_assistance", label: "AI Assistance", icon: Sparkles },
  { id: "independent", label: "Independent Performance", icon: Shield },
  { id: "cognitive", label: "Cognitive Engagement", icon: Brain },
  { id: "assessment", label: "Assessment", icon: Target },
  { id: "interventions", label: "Interventions", icon: Activity },
  { id: "student_success", label: "Student Success", icon: AlertTriangle },
  { id: "equity", label: "Equity and Subgroups", icon: Scale },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "faculty", label: "Faculty", icon: GraduationCap },
  { id: "adoption", label: "Adoption", icon: CreditCard },
  { id: "research", label: "Research", icon: FlaskConical },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "longitudinal", label: "Longitudinal", icon: Layers },
  { id: "pathways", label: "Learning Pathways", icon: GitBranch },
  { id: "data_quality", label: "Data Quality", icon: Database },
]

export const INSTITUTION_ANALYTICS_API_TABS: Record<InstitutionAnalyticsSection, AnalyticsTab[]> = {
  overview: ["overview"],
  questions: ["questions"],
  engagement: ["engagement", "retention"],
  learning: ["learning"],
  ai_assistance: ["cora"],
  independent: ["independent"],
  cognitive: ["cognitive"],
  assessment: ["assessments"],
  interventions: ["interventions"],
  student_success: ["student_success"],
  equity: ["equity"],
  courses: ["courses"],
  faculty: ["faculty"],
  adoption: ["adoption", "license"],
  research: ["research"],
  feedback: ["feedback"],
  longitudinal: ["longitudinal"],
  pathways: ["pathways"],
  data_quality: ["data_quality"],
}

export function parseInstitutionAnalyticsSection(raw: string | null): InstitutionAnalyticsSection {
  if (!raw) return "overview"
  if (LEGACY_SECTION[raw]) return LEGACY_SECTION[raw]
  if (INSTITUTION_ANALYTICS_SECTIONS.includes(raw as InstitutionAnalyticsSection)) {
    return raw as InstitutionAnalyticsSection
  }
  return "overview"
}

export const INSTITUTION_ANALYTICS_PRESETS = [
  { id: "last_7_days", label: "Last 7 days" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "current_term", label: "Current term" },
  { id: "academic_year", label: "Academic year" },
] as const
