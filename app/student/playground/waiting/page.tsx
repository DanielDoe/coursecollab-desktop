"use client"

import { PlaygroundWaitingRoom } from "@/components/playground-waiting-room"

export default function PlaygroundWaitingPage() {
  return (
    <PlaygroundWaitingRoom
      backPath="/student/playground"
      gamePath="/student/playground/game"
    />
  )
}
