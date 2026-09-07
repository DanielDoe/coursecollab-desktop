import { z } from "zod"
import { collectProductionConfigIssues, isProductionRuntime } from "@/lib/compliance/environment"

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_OPENAI_API_KEY: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(env)
}

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  parseServerEnv(env)
  return collectProductionConfigIssues(env)
}

export function assertValidatedProductionEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionRuntime(env)) return
  const issues = validateProductionEnvironment(env).filter((issue) => issue.severity === "blocker")
  if (issues.length) {
    throw new Error(issues.map((issue) => `[${issue.code}] ${issue.message}`).join(" "))
  }
}
