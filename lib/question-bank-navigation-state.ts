/** Persist instructor question bank list UI (menu, topic, filters) in URL query params. */

export type QuestionBankMenu = "all" | "topics" | "types" | "deleted"

export type QuestionBankUiState = {
  menu: QuestionBankMenu
  topic: string | null
  type: string | null
  page: number
  search: string
  typeFilter: string
  difficultyFilter: string
  viewMode: "grid" | "list"
}

const VALID_MENUS = new Set<QuestionBankMenu>(["all", "topics", "types", "deleted"])

export function parseQuestionBankSearchParams(params: URLSearchParams): QuestionBankUiState {
  const topic = params.get("topic")?.trim() || null
  const qtype = params.get("qtype")?.trim() || null
  const menuParam = params.get("menu")?.trim() as QuestionBankMenu | undefined

  let menu: QuestionBankMenu = "all"
  if (topic) menu = "topics"
  else if (qtype) menu = "types"
  else if (menuParam && VALID_MENUS.has(menuParam)) menu = menuParam

  const pageRaw = parseInt(params.get("page") || "1", 10)

  return {
    menu,
    topic,
    type: qtype,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    search: params.get("q")?.trim() || "",
    typeFilter: params.get("filterType")?.trim() || "all",
    difficultyFilter: params.get("difficulty")?.trim() || "all",
    viewMode: params.get("view") === "list" ? "list" : "grid",
  }
}

export function buildQuestionBankListUrl(
  basePath: string,
  state: Partial<QuestionBankUiState>,
): string {
  const params = new URLSearchParams()

  if (state.topic) {
    params.set("menu", "topics")
    params.set("topic", state.topic)
  } else if (state.type) {
    params.set("menu", "types")
    params.set("qtype", state.type)
  } else if (state.menu && state.menu !== "all") {
    params.set("menu", state.menu)
  }

  if (state.page && state.page > 1) params.set("page", String(state.page))
  if (state.search) params.set("q", state.search)
  if (state.typeFilter && state.typeFilter !== "all") params.set("filterType", state.typeFilter)
  if (state.difficultyFilter && state.difficultyFilter !== "all") {
    params.set("difficulty", state.difficultyFilter)
  }
  if (state.viewMode === "list") params.set("view", "list")

  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function isSafeQuestionBankReturnPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false
  if (!path.includes("question-bank")) return false
  return path.startsWith("/instructor/") || path.startsWith("/admin/")
}

export function resolveQuestionBankReturnPath(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  if (!returnTo) return fallback
  try {
    const decoded = decodeURIComponent(returnTo.trim())
    if (isSafeQuestionBankReturnPath(decoded)) return decoded
  } catch {
    /* ignore */
  }
  return fallback
}

export function questionBankUiSnapshot(state: Partial<QuestionBankUiState>): QuestionBankUiState {
  return {
    menu: state.menu ?? "all",
    topic: state.topic ?? null,
    type: state.type ?? null,
    page: state.page ?? 1,
    search: state.search ?? "",
    typeFilter: state.typeFilter ?? "all",
    difficultyFilter: state.difficultyFilter ?? "all",
    viewMode: state.viewMode ?? "grid",
  }
}
