"use client"

import { cn } from "@/lib/utils"

type Props = {
  title: string
  fileCount: number
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function InstructorAnimatedFolder({ title, fileCount, selected = false, onClick, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "instructor-folder text-left focus-visible:outline-none",
        selected && "is-open",
        className,
      )}
    >
      <span className="instructor-folder__shape">
        <span className="instructor-folder__back" aria-hidden />
        <span className="instructor-folder__papers" aria-hidden>
          <span className="instructor-folder__paper instructor-folder__paper--1" />
          <span className="instructor-folder__paper instructor-folder__paper--2" />
          <span className="instructor-folder__paper instructor-folder__paper--3" />
        </span>
        <span className="instructor-folder__front" aria-hidden />
      </span>
      <span className="instructor-folder__meta">
        <span className="instructor-folder__title">{title}</span>
        <span className="instructor-folder__count">
          {fileCount} file{fileCount === 1 ? "" : "s"}
        </span>
      </span>
    </button>
  )
}
