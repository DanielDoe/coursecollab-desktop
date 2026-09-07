"use client"

import { useMemo, useState } from "react"
import { Trophy } from "lucide-react"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { CampLeaderboardContent, type LeaderboardHub } from "@/components/summer-camp/CampLeaderboardContent"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"

export default function CampLeaderboardPage() {
  const [trainingId, setTrainingId] = useState<string | undefined>(undefined)
  const queryParams = useMemo(
    () => (trainingId ? { trainingId } : undefined),
    [trainingId],
  )
  const { data, loading } = useCampHub<LeaderboardHub>("leaderboard", { queryParams })

  const selectedId =
    trainingId ?? (data?.selected_training_id != null ? String(data.selected_training_id) : undefined)

  return (
    <CamperPageShell
      icon={Trophy}
      title="Camp Leaderboard"
      subtitle="See how your XP stacks up against other campers in your training track."
      loading={loading}
    >
      {data && (
        <CampLeaderboardContent
          data={data}
          selectedId={selectedId}
          onTrainingChange={setTrainingId}
        />
      )}
    </CamperPageShell>
  )
}
