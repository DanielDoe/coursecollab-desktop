import { useEffect, useState } from "react"
import { PLAYGROUND_PODIUM_REVEAL_MS } from "@/lib/playground-podium"

/** Delays full leaderboard list until podium animation finishes; resets when sessionKey changes. */
export function usePlaygroundPodiumReveal(sessionKey: string, entryCount: number) {
  const [listRevealed, setListRevealed] = useState(false)

  useEffect(() => {
    setListRevealed(false)
  }, [sessionKey])

  useEffect(() => {
    if (entryCount === 0) {
      setListRevealed(true)
      return
    }
    const timer = window.setTimeout(() => setListRevealed(true), PLAYGROUND_PODIUM_REVEAL_MS)
    return () => window.clearTimeout(timer)
  }, [sessionKey, entryCount])

  return listRevealed
}
