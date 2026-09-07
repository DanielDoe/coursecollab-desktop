export type FacultyCoraStance = "draft" | "confirm" | "analyze" | "explain"
export type FacultyCoraLength = "concise" | "standard" | "thorough"
export type FacultyCoraTone = "professional" | "collegial" | "direct"
export type FacultyCoraWriteConfirm = "always" | "publish_only" | "drafts_ok"
export type FacultyCoraQuestionCount = 4 | 6 | 8 | 10 | 12
export type FacultyCoraDifficulty = "easy" | "medium" | "hard" | "mixed"
export type FacultyCoraBloom = "remember" | "apply" | "analyze" | "mixed"

export type FacultyCoraQuestionTypes = {
  mcq: boolean
  trueFalse: boolean
  selectAll: boolean
  fillBlank: boolean
  freeResponse: boolean
  code: boolean
  codeWrite: boolean
  multiPart: boolean
  circuit: boolean
}

export type FacultyCoraPreferences = {
  defaultStance: FacultyCoraStance
  responseLength: FacultyCoraLength
  tone: FacultyCoraTone
  writeConfirm: FacultyCoraWriteConfirm
  suggestQuestionDrafts: boolean
  defaultQuestionCount: FacultyCoraQuestionCount
  defaultDifficulty: FacultyCoraDifficulty
  bloomFocus: FacultyCoraBloom
  includeSolutions: boolean
  includeRubrics: boolean
  preferCourseTopics: boolean
  questionTypes: FacultyCoraQuestionTypes
  suggestAutomations: boolean
  autoProposeAnnouncements: boolean
  mentionOfficeHours: boolean
  suggestFlashcardsAfterLecture: boolean
  rememberCourseFocus: boolean
  useStudentCoraChats: boolean
  useAssessmentResults: boolean
  useAttendance: boolean
  anonymizeStudentNames: boolean
  persistGlobalMemory: boolean
  persistThreadMemory: boolean
  showActionChips: boolean
  showRelatedModules: boolean
  confirmExpensiveTasks: boolean
  preferLiteLookups: boolean
}

export const DEFAULT_FACULTY_CORA_PREFERENCES: FacultyCoraPreferences = {
  defaultStance: "confirm",
  responseLength: "standard",
  tone: "professional",
  writeConfirm: "always",
  suggestQuestionDrafts: true,
  defaultQuestionCount: 6,
  defaultDifficulty: "mixed",
  bloomFocus: "apply",
  includeSolutions: true,
  includeRubrics: true,
  preferCourseTopics: true,
  questionTypes: {
    mcq: true,
    trueFalse: true,
    selectAll: true,
    fillBlank: false,
    freeResponse: true,
    code: false,
    codeWrite: false,
    multiPart: false,
    circuit: false,
  },
  suggestAutomations: true,
  autoProposeAnnouncements: true,
  mentionOfficeHours: false,
  suggestFlashcardsAfterLecture: true,
  rememberCourseFocus: true,
  useStudentCoraChats: true,
  useAssessmentResults: true,
  useAttendance: true,
  anonymizeStudentNames: false,
  persistGlobalMemory: true,
  persistThreadMemory: true,
  showActionChips: true,
  showRelatedModules: true,
  confirmExpensiveTasks: true,
  preferLiteLookups: true,
}

export const FACULTY_CORA_PREFERENCES_KEY = "facultyCoraPreferences"

const QUESTION_COUNTS = new Set<FacultyCoraQuestionCount>([4, 6, 8, 10, 12])

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

export function mergeFacultyCoraPreferences(
  raw?: Partial<FacultyCoraPreferences> | null,
): FacultyCoraPreferences {
  const parsed = raw ?? {}
  const types = parsed.questionTypes ?? {}
  const count = Number(parsed.defaultQuestionCount)
  return {
    ...DEFAULT_FACULTY_CORA_PREFERENCES,
    ...parsed,
    defaultStance:
      parsed.defaultStance === "draft" ||
      parsed.defaultStance === "confirm" ||
      parsed.defaultStance === "analyze" ||
      parsed.defaultStance === "explain"
        ? parsed.defaultStance
        : DEFAULT_FACULTY_CORA_PREFERENCES.defaultStance,
    responseLength:
      parsed.responseLength === "concise" ||
      parsed.responseLength === "standard" ||
      parsed.responseLength === "thorough"
        ? parsed.responseLength
        : DEFAULT_FACULTY_CORA_PREFERENCES.responseLength,
    tone:
      parsed.tone === "professional" || parsed.tone === "collegial" || parsed.tone === "direct"
        ? parsed.tone
        : DEFAULT_FACULTY_CORA_PREFERENCES.tone,
    writeConfirm:
      parsed.writeConfirm === "always" ||
      parsed.writeConfirm === "publish_only" ||
      parsed.writeConfirm === "drafts_ok"
        ? parsed.writeConfirm
        : DEFAULT_FACULTY_CORA_PREFERENCES.writeConfirm,
    defaultQuestionCount: QUESTION_COUNTS.has(count as FacultyCoraQuestionCount)
      ? (count as FacultyCoraQuestionCount)
      : DEFAULT_FACULTY_CORA_PREFERENCES.defaultQuestionCount,
    defaultDifficulty:
      parsed.defaultDifficulty === "easy" ||
      parsed.defaultDifficulty === "medium" ||
      parsed.defaultDifficulty === "hard" ||
      parsed.defaultDifficulty === "mixed"
        ? parsed.defaultDifficulty
        : DEFAULT_FACULTY_CORA_PREFERENCES.defaultDifficulty,
    bloomFocus:
      parsed.bloomFocus === "remember" ||
      parsed.bloomFocus === "apply" ||
      parsed.bloomFocus === "analyze" ||
      parsed.bloomFocus === "mixed"
        ? parsed.bloomFocus
        : DEFAULT_FACULTY_CORA_PREFERENCES.bloomFocus,
    questionTypes: {
      mcq: asBoolean(types.mcq, true),
      trueFalse: asBoolean(types.trueFalse, true),
      selectAll: asBoolean(types.selectAll, true),
      fillBlank: asBoolean(types.fillBlank, false),
      freeResponse: asBoolean(types.freeResponse, true),
      code: asBoolean(types.code, false),
      codeWrite: asBoolean(types.codeWrite, false),
      multiPart: asBoolean(types.multiPart, false),
      circuit: asBoolean(types.circuit, false),
    },
    suggestQuestionDrafts: asBoolean(parsed.suggestQuestionDrafts, true),
    includeSolutions: asBoolean(parsed.includeSolutions, true),
    includeRubrics: asBoolean(parsed.includeRubrics, true),
    preferCourseTopics: asBoolean(parsed.preferCourseTopics, true),
    suggestAutomations: asBoolean(parsed.suggestAutomations, true),
    autoProposeAnnouncements: asBoolean(parsed.autoProposeAnnouncements, true),
    mentionOfficeHours: asBoolean(parsed.mentionOfficeHours, false),
    suggestFlashcardsAfterLecture: asBoolean(parsed.suggestFlashcardsAfterLecture, true),
    rememberCourseFocus: asBoolean(parsed.rememberCourseFocus, true),
    useStudentCoraChats: asBoolean(parsed.useStudentCoraChats, true),
    useAssessmentResults: asBoolean(parsed.useAssessmentResults, true),
    useAttendance: asBoolean(parsed.useAttendance, true),
    anonymizeStudentNames: asBoolean(parsed.anonymizeStudentNames, false),
    persistGlobalMemory: asBoolean(parsed.persistGlobalMemory, true),
    persistThreadMemory: asBoolean(parsed.persistThreadMemory, true),
    showActionChips: asBoolean(parsed.showActionChips, true),
    showRelatedModules: asBoolean(parsed.showRelatedModules, true),
    confirmExpensiveTasks: asBoolean(parsed.confirmExpensiveTasks, true),
    preferLiteLookups: asBoolean(parsed.preferLiteLookups, true),
  }
}

export function loadFacultyCoraPreferences(): FacultyCoraPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_FACULTY_CORA_PREFERENCES }
  try {
    const raw = localStorage.getItem(FACULTY_CORA_PREFERENCES_KEY)
    if (!raw) return { ...DEFAULT_FACULTY_CORA_PREFERENCES }
    return mergeFacultyCoraPreferences(JSON.parse(raw) as Partial<FacultyCoraPreferences>)
  } catch {
    return { ...DEFAULT_FACULTY_CORA_PREFERENCES }
  }
}

export function saveFacultyCoraPreferences(prefs: FacultyCoraPreferences) {
  if (typeof window === "undefined") return
  localStorage.setItem(FACULTY_CORA_PREFERENCES_KEY, JSON.stringify(prefs))
}

export function buildFacultyCoraPreferencesPrompt(prefs: FacultyCoraPreferences): string {
  const types = Object.entries(prefs.questionTypes)
    .filter(([, on]) => on)
    .map(([id]) => id)
  const typeLabel = types.length ? types.join(", ") : "mcq"

  const stance =
    prefs.defaultStance === "draft"
      ? "Default stance: DRAFT first — prepare materials immediately, then wait for confirmation."
      : prefs.defaultStance === "analyze"
        ? "Default stance: ANALYZE first — inspect course data before proposing writes."
        : prefs.defaultStance === "explain"
          ? "Default stance: EXPLAIN first — clarify the teaching issue, then offer a next action."
          : "Default stance: CONFIRM — prepare confirmation cards before any publish/create."

  const length =
    prefs.responseLength === "concise"
      ? "Length: CONCISE — short answers, lists over essays."
      : prefs.responseLength === "thorough"
        ? "Length: THOROUGH — include rationale, tradeoffs, and next steps."
        : "Length: STANDARD — enough detail to act, no filler."

  const tone =
    prefs.tone === "collegial"
      ? "Tone: collegial and collaborative."
      : prefs.tone === "direct"
        ? "Tone: direct and decisive."
        : "Tone: professional and precise."

  const writes =
    prefs.writeConfirm === "publish_only"
      ? "Writes: confirmation cards required for publish/send; drafts may be prepared without extra confirmation copy."
      : prefs.writeConfirm === "drafts_ok"
        ? "Writes: prepare drafts freely; still use signed confirmation cards for anything that publishes, emails, or creates student-visible work."
        : "Writes: always use signed confirmation cards before create/publish/send."

  const lines = [
    "INSTRUCTOR PREFERENCES (honor these unless the current request overrides them)",
    `- ${stance}`,
    `- ${length}`,
    `- ${tone}`,
    `- ${writes}`,
    `- Assessment drafts: default ${prefs.defaultQuestionCount} items, difficulty ${prefs.defaultDifficulty}, Bloom focus ${prefs.bloomFocus}, types ${typeLabel}.`,
    prefs.includeSolutions ? "- Include solutions / expected answers on drafts." : "- Do not include solutions unless asked.",
    prefs.includeRubrics ? "- Include short rubrics on free-response drafts." : "- Skip rubrics unless asked.",
    prefs.preferCourseTopics
      ? "- Prefer existing course / question-bank topics over inventing new ones."
      : "- New topics are allowed when they help coverage.",
    prefs.autoProposeAnnouncements
      ? "- When they want the class notified, call propose_announcement immediately."
      : "- Ask before proposing an announcement card.",
    prefs.mentionOfficeHours
      ? "- Mention office hours in class communications when relevant."
      : "- Do not mention office hours unless asked.",
    prefs.suggestFlashcardsAfterLecture
      ? "- After lecture work, offer post-lecture flashcards when useful."
      : "- Do not suggest flashcards unless asked.",
    prefs.rememberCourseFocus
      ? "- Keep recent teaching topics in mind for follow-up chats."
      : "- Do not carry forward unofficial course-focus notes.",
    prefs.useStudentCoraChats
      ? "- Use student Cora chat signals for struggle topics."
      : "- Do not cite student Cora chats.",
    prefs.useAssessmentResults
      ? "- Use quiz/homework results when analyzing the class."
      : "- Do not pull assessment results unless asked.",
    prefs.useAttendance
      ? "- Use attendance when it explains engagement."
      : "- Ignore attendance unless asked.",
    prefs.anonymizeStudentNames
      ? "- Anonymize students (Student A, Student B) unless the instructor named someone."
      : "- Use student names when they are already visible to this instructor.",
    prefs.persistGlobalMemory
      ? "- Call remember_fact for lasting instructor preferences."
      : "- Do not persist new global memories.",
    prefs.persistThreadMemory
      ? "- Thread memory is allowed for this conversation."
      : "- Do not persist thread-scoped memories.",
    prefs.preferLiteLookups
      ? "- Prefer cheap lookups/tools for simple status questions; reserve generation for authoring."
      : "- Full generation is allowed even for routine lookups.",
  ]

  return `\n\n${lines.join("\n")}`
}
