import assert from "node:assert/strict"
import test from "node:test"
import {
  deployProbeFailed,
  productionOriginFromEnv,
  probeProductionDeploy,
} from "./production-deploy-probe"

test("productionOriginFromEnv prefers CC_PRODUCTION_ORIGIN", () => {
  assert.equal(
    productionOriginFromEnv({
      CC_PRODUCTION_ORIGIN: "https://example.com/",
      NEXT_PUBLIC_APP_URL: "https://other.com",
    }),
    "https://example.com",
  )
})

test("deployProbeFailed filters non-ok results", () => {
  const failed = deployProbeFailed([
    { origin: "https://x", path: "/a", status: 200, ok: true, detail: "ok" },
    { origin: "https://x", path: "/b", status: 404, ok: false, detail: "missing" },
  ])
  assert.equal(failed.length, 1)
  assert.equal(failed[0]?.path, "/b")
})

test("probeProductionDeploy returns structured results", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith("/privacy")) {
      return new Response("ok", { status: 200 })
    }
    return new Response("missing", { status: 404 })
  }
  try {
    const results = await probeProductionDeploy("https://mock.test")
    assert.equal(results.length >= 5, true)
    assert.equal(results.find((r) => r.path === "/privacy")?.ok, true)
    assert.equal(deployProbeFailed(results).length >= 1, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
