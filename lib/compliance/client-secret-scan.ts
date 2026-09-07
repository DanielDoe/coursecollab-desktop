export type SecretFinding = {
  file: string
  line: number
  kind: string
}

const PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "openai_key", re: /sk-[A-Za-z0-9]{20,}/ },
  { kind: "anthropic_key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: "stripe_secret", re: /sk_live_[A-Za-z0-9]{10,}/ },
  { kind: "stripe_test_secret", re: /sk_test_[A-Za-z0-9]{16,}/ },
  { kind: "stripe_webhook", re: /whsec_[A-Za-z0-9]{10,}/ },
  { kind: "database_url", re: /postgres(?:ql)?:\/\/[^\s"'`]+/i },
  { kind: "private_key", re: /BEGIN [A-Z ]+PRIVATE KEY/ },
  { kind: "public_secret_env", re: /NEXT_PUBLIC_(?:STRIPE_SECRET|OPENAI_API|ANTHROPIC_API|DATABASE|CRON)_[A-Z0-9_]+\s*=\s*["']?(?:sk_|whsec_|postgres)/ },
]

const PLACEHOLDER =
  /(your_|example|placeholder|changeme|xxxx|sk-example|sk_live_example|whsec_example|user:pass@)/i

const SCAN_SKIP =
  /^(lib\/compliance\/|scripts\/|tests\/|docs\/|\.cursor\/|\.agents\/|migrations\/)/

export function scanTextForSecrets(relativePath: string, source: string): SecretFinding[] {
  const normalized = relativePath.replace(/\\/g, "/")
  if (SCAN_SKIP.test(normalized) || normalized.endsWith(".test.ts")) return []
  const findings: SecretFinding[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (PLACEHOLDER.test(line)) return
    if (/env\.NEXT_PUBLIC_(?:STRIPE_SECRET|OPENAI_API|ANTHROPIC_API)/.test(line)) return
    for (const pattern of PATTERNS) {
      if (pattern.re.test(line)) {
        findings.push({ file: relativePath, line: index + 1, kind: pattern.kind })
        break
      }
    }
  })
  return findings
}
