"use client"

import { cn } from "@/lib/utils"
import {
  CODEBENCH_TOPIC_SELECT_CLASS,
  type CodebenchCourseTopic,
} from "@/lib/codebench-course-topics"

type Props = {
  value: string
  onChange: (topicId: string) => void
  topics: CodebenchCourseTopic[]
  className?: string
}

export function CodebenchTopicFilterSelect({ value, onChange, topics, className }: Props) {
  return (
    <select
      aria-label="Filter by topic"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CODEBENCH_TOPIC_SELECT_CLASS, className)}
    >
      <option value="all">All topics</option>
      {topics.map((topic) => (
        <option key={topic.id} value={topic.id}>
          {topic.label}
        </option>
      ))}
    </select>
  )
}
