"use client"

import Link from "next/link"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

interface AppHeaderProps {
  showBackButton?: boolean
}

export function AppHeader({ showBackButton = false }: AppHeaderProps) {
  const homeLink = useSmartHomeLink()

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto px-4 py-4">
        <Link href={homeLink} className="flex items-center hover:opacity-80 transition-opacity">
          <CourseCollabLogo size="md" withWordmark />
        </Link>
      </div>
    </header>
  )
}
