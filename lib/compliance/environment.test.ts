/**
 * Run: npx tsx --test lib/compliance/environment.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  collectProductionConfigIssues,
  isProhibitedPublicOrigin,
  resolveRuntimeEnvironment,
} from "@/lib/compliance/environment"

describe("production environment", () => {
  it("classifies localhost as prohibited", () => {
    assert.equal(isProhibitedPublicOrigin("http://localhost:3000"), true)
    assert.equal(isProhibitedPublicOrigin("https://127.0.0.1"), true)
    assert.equal(isProhibitedPublicOrigin("https://course-collab.com"), false)
  })

  it("treats VERCEL_ENV=production as production", () => {
    assert.equal(resolveRuntimeEnvironment({ VERCEL_ENV: "production" }), "production")
    assert.equal(resolveRuntimeEnvironment({ NODE_ENV: "development" }), "development")
  })

  it("fails production when public origin is localhost", () => {
    const issues = collectProductionConfigIssues({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/cc",
    })
    assert.ok(issues.some((issue) => issue.code === "invalid_public_origin"))
    assert.ok(issues.some((issue) => issue.code === "development_database"))
  })

  it("fails when production API origin is missing", () => {
    const issues = collectProductionConfigIssues({
      VERCEL_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@ep-prod.us.aws.neon.tech/neondb",
    })
    assert.ok(issues.some((issue) => issue.code === "missing_public_origin"))
  })

  it("fails missing required secrets in production", () => {
    const issues = collectProductionConfigIssues({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://course-collab.com",
      DATABASE_URL: "postgresql://user:pass@ep-prod.us.aws.neon.tech/neondb",
    })
    assert.ok(issues.some((issue) => issue.code === "missing_stripe_secret"))
    assert.ok(issues.some((issue) => issue.code === "missing_ai_provider"))
  })

  it("rejects public privileged secrets", () => {
    const issues = collectProductionConfigIssues({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://course-collab.com",
      DATABASE_URL: "postgresql://user:pass@ep-prod.us.aws.neon.tech/neondb",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
      OPENAI_API_KEY: "sk-example",
      NEXT_PUBLIC_STRIPE_SECRET_KEY: "sk_live_leaked",
    })
    assert.ok(issues.some((issue) => issue.code === "public_stripe_secret"))
  })
})
