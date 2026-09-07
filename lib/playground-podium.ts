export type PlaygroundPodiumEntry = {
  rank: number | null
  displayName: string
  studentName?: string
  score: number
}

export const PLAYGROUND_PODIUM_REVEAL_MS = 2800

export function buildPodiumEntries<T extends PlaygroundPodiumEntry>(entries: T[]): T[] {
  const ranked = [...entries]
    .filter((e) => e.rank != null && e.rank <= 3)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  if (ranked.length > 0) return ranked

  return [...entries]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
