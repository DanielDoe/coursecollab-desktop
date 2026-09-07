"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FilePenLine, Home, Mail, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { portalCta, portalNavLink, portalNavLinkActive } from "@/lib/appearance/portal-shell-theme"

type Props = {
  showCareer?: boolean
}

const CAREER_PREFIXES = ["/guest/cora-career", "/guest/career", "/guest/cora-credits"]

export function GuestWorkspaceNav({ showCareer = true }: Props) {
  const pathname = usePathname() ?? ""
  const onHome = pathname === "/guest"
  const onRecommendations = pathname.startsWith("/guest/recommendations")
  const onCareer = CAREER_PREFIXES.some((p) => pathname.startsWith(p))
  const onMessages = pathname === "/guest/messages"

  return (
    <>
      <Link href="/guest" className={cn(portalNavLink, onHome && portalNavLinkActive)}>
        <Home className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        Home
      </Link>
      <Link
        href="/guest/recommendations"
        className={cn(portalNavLink, onRecommendations && portalNavLinkActive)}
      >
        <FilePenLine className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        Recommendations
      </Link>
      {showCareer ? (
        <Link href="/guest/cora-career" className={cn(portalNavLink, onCareer && portalNavLinkActive)}>
          <Sparkles className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          Cora Career
        </Link>
      ) : null}
      <Link href="/guest/messages" className={cn(portalNavLink, onMessages && portalNavLinkActive)}>
        <Mail className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        Messages
      </Link>
      {onRecommendations ? (
        <Link href="/guest/recommendations/request" className={portalCta}>
          New request
        </Link>
      ) : null}
    </>
  )
}
