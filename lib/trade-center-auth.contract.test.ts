/**
 * Run: npx tsx --test lib/trade-center-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, "..")

const STUDENT_AUTH =
  /requireBoundStudentCaller|requireCallerStudentDbId|requireAuthenticatedStudentFromRequest|requireAuthenticatedStudentTradeAccess/

const STUDENT_ROUTES = [
  "app/api/trade-center/points/route.ts",
  "app/api/trade-center/my-history/route.ts",
  "app/api/trade-center/peers/route.ts",
  "app/api/trade-center/donation-requests/route.ts",
  "app/api/trade-center/point-requests/route.ts",
  "app/api/trade-center/trade/route.ts",
  "app/api/trade-center/donate/route.ts",
  "app/api/trade-center/sync/route.ts",
  "app/api/trade-center/point-requests/[id]/approve-peer/route.ts",
  "app/api/trade-center/point-requests/[id]/reject-peer/route.ts",
  "app/api/trade-center/points-for-rollover/route.ts",
  "app/api/trade-center/points-for-extra-attempts/route.ts",
  "app/api/trade-center/classroom-transfer-eligibility/route.ts",
] as const

function readRel(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

describe("Trade Center student auth contract", () => {
  it("session-binds requireAuthenticatedStudentFromRequest", () => {
    const src = readRel("lib/trade-center-student-access.ts")
    assert.match(src, /requireBoundStudentCaller/)
    const helper = src.slice(src.indexOf("export async function requireAuthenticatedStudentFromRequest"))
    assert.match(helper, /requireBoundStudentCaller/)
    assert.doesNotMatch(
      helper.slice(0, helper.indexOf("export async function requireAuthenticatedStudentTradeAccess")),
      /resolveStudentDatabaseIdFromParam\(header\)/,
    )
  })

  it("config student branch uses requireCallerStudentDbId", () => {
    const src = readRel("lib/trade-center-request-auth.ts")
    const route = readRel("app/api/trade-center/config/route.ts")
    assert.match(src, /requireCallerStudentDbId/)
    assert.doesNotMatch(src, /requireAuthenticatedStudentFromRequest/)
    assert.match(route, /requireTradeCenterConfigRead/)
  })

  for (const rel of STUDENT_ROUTES) {
    it(`${rel} binds the student caller session`, () => {
      const src = readRel(rel)
      assert.match(src, STUDENT_AUTH)
    })
  }

  it("trade / donate / sync do not use membership-only requireStudentTradeAccess", () => {
    for (const rel of [
      "app/api/trade-center/trade/route.ts",
      "app/api/trade-center/donate/route.ts",
      "app/api/trade-center/sync/route.ts",
    ] as const) {
      const src = readRel(rel)
      assert.doesNotMatch(src, /requireStudentTradeAccess\(/)
      assert.match(src, /requireBoundStudentCaller|requireAuthenticatedStudentTradeAccess/)
    }
  })

  it("peer approve/reject bind requestee to requireBoundStudentCaller", () => {
    const approve = readRel("app/api/trade-center/point-requests/[id]/approve-peer/route.ts")
    const reject = readRel("app/api/trade-center/point-requests/[id]/reject-peer/route.ts")
    assert.match(approve, /requireBoundStudentCaller/)
    assert.match(reject, /requireBoundStudentCaller/)
  })

  it("donation approve returns 404 when no pending in-scope row", () => {
    const src = readRel("app/api/trade-center/donation-requests/[id]/approve/route.ts")
    assert.match(src, /status: 404/)
    assert.match(src, /Request not found or already processed/)
    assert.match(src, /SELECT dr\.id/)
    assert.doesNotMatch(
      src,
      /UPDATE donation_requests dr[\s\S]*FROM students d[\s\S]*JOIN students r ON dr\.recipient_id/,
    )
  })
})
