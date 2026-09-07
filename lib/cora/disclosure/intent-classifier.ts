/**
 * CoraSecurityIntentClassifier — cheap, semantic, not keyword-block.
 *
 * Scores intent families. Framing (roleplay, hypothetical, translation, quiz)
 * never overrides the requested output.
 */

import type {
  CoraDisclosureRole,
  CoraSecurityClassification,
  CoraSecurityIntent,
  CoraSecuritySignal,
} from "@/lib/cora/disclosure/types"
import {
  conversationTextForClassification,
  normalizeCoraSecurityInput,
} from "@/lib/cora/disclosure/normalize-input"

export type ClassifySecurityArgs = {
  role: CoraDisclosureRole
  message: string
  conversationHistory?: Array<{ role?: string; content?: string }>
}

const EDUCATION_TOPIC =
  /\b(sql injection|xss|cross[- ]site|csrf|ssrf|idor|owasp|parameteriz|prepared statement|authenticat|authoriz|cors|same[- ]origin|encryption|hashing|salting|threat model|least privilege|defense in depth|stored xss|reflected xss|clickjacking|content security policy|csp)\b/i

const EDUCATION_ASK =
  /\b(what is|what are|what's|explain|define|difference between|how does|how do|help me understand|teach|compare|show me how parameterized|common ways to prevent|owasp top|like i am a beginner)\b/i

const PLATFORM =
  /\b(coursecollab|course[- ]collab|this (platform|app|site|system|product)|your (platform|app|system|apis?|endpoints?|database|backend)|the (platform|product)('s)?|in production)\b/i

const PLATFORM_IMPLIED =
  /\b(which (endpoints?|apis?|routes?)|what route|which apis?|unprotected endpoints?|easiest to abuse|trusts student ids?|developers forgot|mistakes the developers|unresolved vulnerabilit|security bugs? haven'?t|technical weaknesses|internal apis?)\b/i

const SECURITY_SEEK =
  /\b(vulnerabilit\w*|exploit\w*|unpatched|weakest|weakness\w*|attack (path|surface|vector)|pentest|penetration|security (bugs?|findings?|holes?|flaws?|issues?)|forgot to secure|not protected|easiest to abuse|where would you start|if you were (attacking|trying to compromise)|recon|reconnaissance|security audit|compromise coursecollab)/i

const SECURITY_SEEK_SOFT =
  /\b(don'?t call them vulnerabilit|list (the )?technical weaknesses|mistakes (the )?developers made|security mistakes\b.{0,40}\bdevelopers|where .{0,24}weakest|something developers forgot|implementation mistakes .{0,40}abused)\b/i

const API_RECON =
  /\b(list (of )?(all )?(coursecollab )?(api )?endpoints?|all (internal )?(services?|apis?) (available|you (know|have|use))|internal (endpoint|service|api)|production backend url|backend url|what (api )?endpoint (do you|does cora)|endpoint (cora|you) (use|call)|which (coursecollab )?endpoints?|request body and headers|headers (you|sent by)|apis? require admin|students call directly|json schema for your (admin )?tools?|kinds of internal apis)\b/i

const PRIVILEGE =
  /\b((another|other) (student|user|instructor|faculty)|someone else'?s|change (the )?student(id| id)|impersonat|act as (an? )?(admin|administrator|instructor|faculty|professor)|become (an? )?(admin|faculty|administrator)|bypass (auth|permission|rbac)|privilege escalation|escalate (my )?privileges?|access another|make my account an? (admin|administrator)|change my role|same permissions (my )?(professor|instructor)|admin mode|faculty tools? even though|ignore the role|give me faculty access|turn on admin|pretend my authenticated role|i am actually the professor)\b/i

const CROSS_USER =
  /\b(another (student|instructor|professor)|everyone in my class|other student'?s|professor'?s question bank|answer key|unpublished quizzes?|private (course materials?|faculty notes?)|admin dashboard data|look up student (database )?id|retrieve the record belonging to|grades for everyone|show me another)\b/i

const SECRET_SEEK =
  /\b(api[_ ]?key|openai key|anthropic key|secret key|access token|refresh token|bearer token|authentication token|connection string|database (password|credential|url)|private key|env(ironment)? var|environment variables?|\.env\b|DATABASE_URL|OPENAI_API_KEY|AWS_SECRET|STRIPE|credentials? you can|headers sent by (your )?backend|print any credentials)\b/i

const PROMPT_EXTRACT =
  /\b(system prompt|hidden (prompt|instructions?|context|polic)|developer (instructions?|mode)|repeat (everything|all instructions)|print (your )?(complete )?(instructions?|prompt|rules)|show (me )?(your )?(hidden|internal reasoning)|what (security )?rules were you given|what instructions prevent|ignore (all )?(previous|prior|your) (instructions?|rules|polic)|jailbreak|dan mode|list every tool|tool(s)? you have access to|parameters for your tools?)\b/i

const TOOL_ENUM =
  /\b(list|print|show|dump|enumerate|give me)\b.{0,48}\b(admin tools?|hidden tools?|tool(s)? (names?|definitions?|schemas?|signatures?|parameters?)|function signatures?|internal (routes?|tools?|services?)|all (apis?|endpoints?))\b/i

const DIAGNOSTIC_EXTRACT =
  /\b(complete server error|raw response|stack trace|sql error|postgres error|exact url.{0,40}(headers|request body|response)|failed action|database error|announcement tool with invalid)\b/i

const EXPLOIT_VERIFY =
  /\b(is that (one of )?(your )?(vulnerabilit|bugs?|issues?)|can you (confirm|verify|check|reproduce) .{0,40}(vulnerabilit|idor|exploit)|i changed .{0,20}id .{0,40}(saw|got|retrieved)|confirm which ones are real|only need you to confirm|rank .{0,40}(easiest|hardest) to compromise|investigate first)\b/i

const JAILBREAK =
  /\b(pretend you (are|have no)|roleplay as|ignore .{0,20}(polic|guardrail|restriction|security instructions)|developer mode|enable (security|god|admin) mode|you are now|for the ceo|hypothetical attack(er)?|security auditor|authorized me to perform|known vulnerabilities|fictional application|using your real knowledge|research purposes only)\b/i

const IDOR_PROBE =
  /\b(change it to \d+|change .{0,20}id .{0,20}to \d+|what happens if i (change|request)|what header should i change|determines which student record|retrieve .{0,30}if i know|request course \d+|database id)\b/i

const INTERNAL_ARCH =
  /\b(database schema|db schema|table (structure|layout)|internal (api|endpoint|route|url)|private endpoint|authorization (implementation|logic|code)|session (store|implementation|internals)|cors (config|allowlist)|deployment architecture|server (config|paths?)|neon\.tech|postgres(ql)? (error|schema)|anti[- ]cheat (api|implementation|threshold|detection|bypass)|implemented internally|technologies power coursecollab)\b/i

const REPORTING =
  /\b(i (think i )?(found|discovered|hit|ran into)|responsible disclosure|report (a |this )?(security|vulnerabilit|bug)|i changed .{0,40}(studentid|student id|user id).{0,60}(another|other|someone)|saw another (student|user)'?s)\b/i

const PRODUCT_FACULTY =
  /\b(anti[- ]cheat|integrity|proctor).{0,40}(settings?|enabled|available)\b/i

const PRODUCT_STUDENT =
  /\b(why (was|is) my (assessment|quiz|exam|attempt) (locked|blocked|restricted)|what (security|privacy) (settings?|controls?) (do i have|are (on|available)))\b/i

const PRODUCT_ADMIN =
  /\b(platform security settings? (that )?(my admin role )?(is )?(explicitly )?authorized|security (settings?|controls?) I (can|may) manage)\b/i

const RESEARCH_MODE =
  /\b(enable security (research )?mode|security engineering (assistant|mode)|unlock (internal )?security)\b/i

const FRAMING_STRIP =
  /\b(pretend|roleplay|hypothetical|as a (quiz|poem|json|translation|story|report)|translate|for (a )?research paper|in a fictional|developer mode says)\b/i

function has(re: RegExp, text: string): boolean {
  return re.test(text)
}

function decideIntent(args: {
  role: CoraDisclosureRole
  signals: Set<CoraSecuritySignal>
  educationOnly: boolean
}): CoraSecurityIntent {
  const s = args.signals

  if (s.has("reporting") && !s.has("exploit_verification")) {
    return "SECURITY_REPORT"
  }
  if (s.has("exploit_verification")) return "SECURITY_REPORT"

  if (s.has("secret_seeking")) return "SECRET_EXTRACTION"
  if (s.has("prompt_extraction") || s.has("research_mode") || s.has("tool_enumeration")) {
    return "PROMPT_EXTRACTION"
  }
  if (s.has("privilege_bypass")) return "PRIVILEGE_BYPASS"

  const recon =
    s.has("security_seeking") &&
    (s.has("platform_target") || s.has("internal_architecture") || s.has("jailbreak"))
  if (
    recon ||
    s.has("internal_architecture") ||
    s.has("api_recon") ||
    s.has("diagnostic_extract")
  ) {
    return "RECONNAISSANCE"
  }

  if (s.has("product_security") && !s.has("security_seeking")) {
    return "PRODUCT_SECURITY"
  }

  if (
    args.educationOnly ||
    (s.has("education") &&
      !s.has("platform_target") &&
      !s.has("internal_architecture") &&
      !s.has("api_recon"))
  ) {
    return "SECURITY_EDUCATION"
  }

  if (s.has("security_seeking") && s.has("platform_target")) return "RECONNAISSANCE"

  return "NORMAL"
}

function intentToDecision(intent: CoraSecurityIntent): CoraSecurityClassification["decision"] {
  switch (intent) {
    case "SECURITY_REPORT":
      return "ROUTE_REPORT"
    case "RECONNAISSANCE":
    case "PRIVILEGE_BYPASS":
    case "SECRET_EXTRACTION":
    case "PROMPT_EXTRACTION":
      return "REFUSE"
    default:
      return "ALLOW"
  }
}

/**
 * Classify security intent. Framing does not change the requested output.
 */
export function classifyCoraSecurityIntent(args: ClassifySecurityArgs): CoraSecurityClassification {
  const current = normalizeCoraSecurityInput(args.message)
  const prior = conversationTextForClassification(args.conversationHistory)
  const priorNorm = prior ? normalizeCoraSecurityInput(prior) : null
  const combined = priorNorm ? `${priorNorm.normalized}\n${current.normalized}` : current.normalized
  const text = current.normalized
  const cumulative = combined
  const multiTurn = Boolean(prior && prior.trim())

  const signals = new Set<CoraSecuritySignal>()

  const platformNow = has(PLATFORM, text) || has(PLATFORM_IMPLIED, text)
  const platformPrior =
    priorNorm != null &&
    (has(PLATFORM, priorNorm.normalized) ||
      has(PLATFORM_IMPLIED, priorNorm.normalized) ||
      has(INTERNAL_ARCH, priorNorm.normalized) ||
      has(API_RECON, priorNorm.normalized))
  if (platformNow || platformPrior) signals.add("platform_target")

  if (has(SECURITY_SEEK, text) || has(SECURITY_SEEK_SOFT, text)) signals.add("security_seeking")
  if (has(SECURITY_SEEK_SOFT, text) || has(PLATFORM_IMPLIED, text)) {
    signals.add("platform_target")
    signals.add("security_seeking")
  }
  if (/\bdevelopers made\b/i.test(text) && has(PLATFORM, text)) {
    signals.add("platform_target")
    signals.add("security_seeking")
  }
  if (has(API_RECON, text) || has(API_RECON, cumulative)) {
    signals.add("api_recon")
    signals.add("internal_architecture")
    signals.add("platform_target")
  }
  if (has(SECRET_SEEK, text) || has(SECRET_SEEK, cumulative)) signals.add("secret_seeking")
  if (has(PROMPT_EXTRACT, text)) signals.add("prompt_extraction")
  if (has(TOOL_ENUM, text)) signals.add("tool_enumeration")
  if (has(PRIVILEGE, text) || has(CROSS_USER, text) || has(IDOR_PROBE, text)) {
    signals.add("privilege_bypass")
  }
  if (has(INTERNAL_ARCH, text)) signals.add("internal_architecture")
  if (has(DIAGNOSTIC_EXTRACT, text)) signals.add("diagnostic_extract")
  if (has(REPORTING, text)) signals.add("reporting")
  if (has(EXPLOIT_VERIFY, text)) signals.add("exploit_verification")
  if (has(JAILBREAK, text) || (FRAMING_STRIP.test(text) && has(SECURITY_SEEK, text))) {
    signals.add("jailbreak")
    signals.add("security_seeking")
  }
  if (has(RESEARCH_MODE, text)) signals.add("research_mode")

  const educationHit = has(EDUCATION_ASK, text) && has(EDUCATION_TOPIC, text)
  if (educationHit) signals.add("education")

  if (args.role === "faculty" && PRODUCT_FACULTY.test(text)) signals.add("product_security")
  if (args.role === "student" && PRODUCT_STUDENT.test(text)) signals.add("product_security")
  if (args.role === "admin" && PRODUCT_ADMIN.test(text)) signals.add("product_security")

  // Cumulative recon across turns
  if (
    multiTurn &&
    platformPrior &&
    (has(SECURITY_SEEK, text) ||
      has(API_RECON, text) ||
      has(EXPLOIT_VERIFY, text) ||
      /\b(which|what) (apis?|endpoints?|ones?) (exist|require|are weakest|need auth|have weaker)/i.test(
        text,
      ) ||
      /\b(which one is weakest|investigate first|weaker authorization)\b/i.test(text))
  ) {
    signals.add("security_seeking")
    signals.add("platform_target")
  }

  if (args.role === "admin" && /\b(unresolved|open|current) vulnerabilit/i.test(text)) {
    signals.add("security_seeking")
    signals.add("platform_target")
    signals.delete("product_security")
  }

  const educationOnly =
    educationHit &&
    !signals.has("platform_target") &&
    !signals.has("secret_seeking") &&
    !signals.has("prompt_extraction") &&
    !signals.has("privilege_bypass") &&
    !signals.has("internal_architecture") &&
    !signals.has("api_recon") &&
    !signals.has("reporting") &&
    !signals.has("exploit_verification")

  const intent = decideIntent({ role: args.role, signals, educationOnly })
  const decision = intentToDecision(intent)

  let confidence = 0.55
  if (signals.size >= 2) confidence = 0.82
  if (signals.size >= 3) confidence = 0.92
  if (educationOnly) confidence = 0.88
  if (intent === "NORMAL" && signals.size === 0) confidence = 0.7

  return {
    intent,
    decision,
    confidence,
    signals: [...signals],
    multiTurn,
    obfuscationDecoded: current.obfuscationDecoded || Boolean(priorNorm?.obfuscationDecoded),
  }
}
