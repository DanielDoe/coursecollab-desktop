import type { CoraDomain } from "@/lib/cora/types"
import type { CoraDiagramSpec } from "@/lib/cora/step-engine/types"

export function diagramForDomain(domain: CoraDomain, mediaUrl?: string | null): CoraDiagramSpec | undefined {
  if (mediaUrl) {
    return {
      kind: domain === "coding" ? "flowchart" : "circuit",
      title: domain === "coding" ? "Program flow" : "Circuit diagram",
      mediaUrl,
      highlights: [],
    }
  }
  if (domain === "coding") {
    return { kind: "memory", title: "Execution workspace", description: "Variables and control flow animate here." }
  }
  if (domain === "circuit") {
    return { kind: "circuit", title: "Circuit canvas", description: "Nodes, branches, and quantities highlight as you progress." }
  }
  return undefined
}

export function defaultConcepts(domain: CoraDomain): string[] {
  switch (domain) {
    case "circuit":
      return ["Circuit analysis", "Variable identification", "Conservation laws"]
    case "coding":
      return ["Algorithm design", "Tracing execution", "Debugging mindset"]
    case "math":
      return ["Symbolic reasoning", "Unit consistency"]
    default:
      return ["Problem decomposition", "Verification"]
  }
}
