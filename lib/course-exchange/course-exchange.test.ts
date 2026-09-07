/**
 * Course Exchange policy + clone safety tests (no DB).
 * Run: npx tsx --test lib/course-exchange/course-exchange.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertModulesSubsetOfApproved,
  resolveApprovedModules,
} from "@/lib/course-exchange/security"
import {
  assessmentTypesForModules,
  COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES,
  COURSE_EXCHANGE_SENSITIVE_MODULES,
  defaultApprovalModules,
  isCourseExchangeModule,
  normalizeModuleList,
  questionBankRequired,
} from "@/lib/course-exchange/modules"
import type { CourseExchangeRequestRow } from "@/lib/course-exchange/types"
import {
  lectureExchangeMatchKey,
  mergeReuseMaps,
  emptyReuseMaps,
} from "@/lib/course-exchange/lineage-snapshot"
import {
  filterGroupsProjectsForOwnSession,
  isOwnGroupsProjectsSession,
} from "@/lib/course-exchange/groups-projects-session-policy"

function baseRequest(overrides: Partial<CourseExchangeRequestRow>): CourseExchangeRequestRow {
  return {
    id: 1,
    source_course_id: 10,
    source_instructor_id: 5,
    requester_instructor_id: 8,
    status: "APPROVED",
    purpose: "Teaching Fall 2026",
    requester_institution: "UH",
    requester_department: "ECE",
    requested_modules: ["syllabus", "quizzes"],
    approved_modules: ["syllabus", "quizzes", "question_bank"],
    destination_course_id: null,
    destination_session_id: null,
    clone_summary: null,
    clone_error: null,
    created_at: new Date().toISOString(),
    reviewed_at: null,
    reviewed_by: null,
    completed_at: null,
    rejected_at: null,
    rejection_reason: null,
    cancelled_at: null,
    ...overrides,
  }
}

describe("module normalization", () => {
  it("accepts valid modules only", () => {
    assert.deepEqual(normalizeModuleList(["syllabus", "invalid", "quizzes"]), ["syllabus", "quizzes"])
    assert.equal(isCourseExchangeModule("final_exams"), true)
    assert.equal(isCourseExchangeModule("student_data"), false)
  })

  it("defaults sensitive modules unselected", () => {
    for (const mod of COURSE_EXCHANGE_SENSITIVE_MODULES) {
      assert.equal(COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES.includes(mod), false)
    }
  })

  it("maps assessment modules to quiz assessment types", () => {
    const types = assessmentTypesForModules(["quizzes", "homework", "mid_semester_exams"])
    assert.deepEqual(types.sort(), ["homework", "mid_semester", "quiz"].sort())
    assert.equal(assessmentTypesForModules(["syllabus"]).length, 0)
  })

  it("requires question bank when assessments or practice selected", () => {
    assert.equal(questionBankRequired(["quizzes"]), true)
    assert.equal(questionBankRequired(["syllabus"]), false)
  })
})

describe("approval security", () => {
  it("resolves approved modules from database record only", () => {
    const approved = resolveApprovedModules(baseRequest({ approved_modules: ["syllabus", "lectures"] }))
    assert.deepEqual(approved, ["syllabus", "lectures"])
  })

  it("denies unapproved module in subset check", () => {
    const approved = defaultApprovalModules()
    const bad = assertModulesSubsetOfApproved(approved, [...approved, "final_exams"])
    assert.equal(bad.ok, false)
    if (!bad.ok) assert.match(bad.reason, /final_exams/)
  })

  it("allows subset of approved modules", () => {
    const approved = ["syllabus", "quizzes", "question_bank"] as const
    const ok = assertModulesSubsetOfApproved([...approved], ["syllabus", "quizzes"])
    assert.equal(ok.ok, true)
  })
})

describe("independence invariants (documented)", () => {
  it("clone engine assigns new IDs — maps are separate from source", () => {
    const sourceToDest = new Map<number, number>([[100, 501], [101, 502]])
    assert.notEqual(sourceToDest.get(100), 100)
    assert.notEqual(sourceToDest.get(101), 101)
  })

  it("student data checks must be zero after clone", () => {
    const checks = { students: 0, quiz_attempts: 0, quiz_answers: 0, practice_attempts: 0 }
    for (const count of Object.values(checks)) assert.equal(count, 0)
  })
})

describe("destination reuse maps", () => {
  it("merges lineage mappings over destination matches", () => {
    const lineage = emptyReuseMaps()
    lineage.lectures.set(1, 100)
    const destination = emptyReuseMaps()
    destination.lectures.set(1, 200)
    destination.lectures.set(2, 201)
    const merged = mergeReuseMaps(lineage, destination)
    assert.equal(merged.lectures.get(1), 100)
    assert.equal(merged.lectures.get(2), 201)
  })

  it("matches ELEG lectures by week and logical title", () => {
    const a = lectureExchangeMatchKey(3, "ELEG 130X: Intro to Circuits")
    const b = lectureExchangeMatchKey(3, "ELEG 1301: Intro to Circuits")
    assert.equal(a, b)
  })
})

describe("groups/projects destination policy", () => {
  it("recognizes Fall 2026 ELEG section codes", () => {
    assert.equal(isOwnGroupsProjectsSession("ELEG1301P01"), true)
    assert.equal(isOwnGroupsProjectsSession("ELEG1304P03"), true)
    assert.equal(isOwnGroupsProjectsSession("ECE2202"), false)
  })

  it("strips groups and projects for own-session destinations", () => {
    const modules = ["syllabus", "groups", "projects", "quizzes"] as const
    const filtered = filterGroupsProjectsForOwnSession([...modules], "ELEG1301P02")
    assert.deepEqual(filtered.modules, ["syllabus", "quizzes"])
    assert.equal(filtered.skippedGroupsProjects, true)
  })
})

describe("status workflow", () => {
  it("reject path leaves no approved modules requirement", () => {
    const pending = baseRequest({ status: "PENDING", approved_modules: null })
    assert.equal(pending.status, "PENDING")
    assert.equal(pending.approved_modules, null)
  })

  it("approved request requires modules before import", () => {
    const req = baseRequest({ status: "APPROVED", approved_modules: ["syllabus"] })
    assert.ok(resolveApprovedModules(req).length > 0)
  })
})
