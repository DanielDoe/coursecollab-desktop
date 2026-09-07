export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return
  const { assertProductionConfig } = await import("@/lib/compliance/environment")
  assertProductionConfig(process.env, { requirePayments: false, requireAi: false })
}
