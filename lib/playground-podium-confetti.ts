import confetti from "canvas-confetti"

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Confetti bursts timed to podium medal drops — gold center, silver left, bronze right. */
export function firePlaygroundPodiumConfetti(hasSecond: boolean, hasThird: boolean): void {
  if (prefersReducedMotion()) return

  const gold = ["#fbbf24", "#f59e0b", "#fde68a", "#a855f7", "#6366f1"]
  const silver = ["#e2e8f0", "#cbd5e1", "#94a3b8"]
  const bronze = ["#fb923c", "#ea580c", "#fdba74"]

  window.setTimeout(() => {
    confetti({
      particleCount: 70,
      spread: 68,
      origin: { x: 0.5, y: 0.58 },
      colors: gold,
      scalar: 1.05,
    })
    confetti({
      particleCount: 40,
      angle: 58,
      spread: 52,
      origin: { x: 0.38, y: 0.62 },
      colors: gold,
    })
    confetti({
      particleCount: 40,
      angle: 122,
      spread: 52,
      origin: { x: 0.62, y: 0.62 },
      colors: gold,
    })
  }, 380)

  if (hasSecond) {
    window.setTimeout(() => {
      confetti({
        particleCount: 28,
        spread: 48,
        origin: { x: 0.26, y: 0.64 },
        colors: silver,
      })
    }, 580)
  }

  if (hasThird) {
    window.setTimeout(() => {
      confetti({
        particleCount: 28,
        spread: 48,
        origin: { x: 0.74, y: 0.66 },
        colors: bronze,
      })
    }, 720)
  }
}
