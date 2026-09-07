"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AccessRequestStatusPanel,
  type AccessRequestStatusPayload,
} from "@/components/auth/AccessRequestStatusPanel"
import { AccessStatusShell } from "@/components/auth/access-status-shell"
import {
  clearAccessStatusPayload,
  loadAccessStatusPayload,
  loadAccessStatusPortal,
  type AccessStatusPortal,
} from "@/lib/access-governance/access-status-session"
import type { AccountLifecycleStatus } from "@/lib/access-governance/types"

function portalLinks(portal: AccessStatusPortal): {
  fallbackHref: string
  updateHref?: string
  supportHref: string
} {
  switch (portal) {
    case "faculty":
      return { fallbackHref: "/faculty/login", supportHref: "/instructor/help" }
    case "guest":
      return { fallbackHref: "/guest", updateHref: "/guest", supportHref: "/guest" }
    default:
      return {
        fallbackHref: "/student/login",
        updateHref: "/student/login?tab=join",
        supportHref: "/student/help",
      }
  }
}

export function AccessRequestStatusScreen({
  allowedLifecycles,
  fallbackHref: fallbackOverride,
  updateHref: updateOverride,
  supportHref: supportOverride,
}: {
  allowedLifecycles: readonly AccountLifecycleStatus[]
  fallbackHref?: string
  updateHref?: string
  supportHref?: string
}) {
  const router = useRouter()
  const [payload, setPayload] = useState<AccessRequestStatusPayload | null>(null)
  const [ready, setReady] = useState(false)
  const portal = loadAccessStatusPortal()
  const links = portalLinks(portal)
  const fallbackHref = fallbackOverride ?? links.fallbackHref
  const updateHref = updateOverride ?? links.updateHref
  const supportHref = supportOverride ?? links.supportHref

  useEffect(() => {
    const stored = loadAccessStatusPayload()
    setPayload(stored)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !payload) return
    if (payload.lifecycle === "not_found") return
    if (!allowedLifecycles.includes(payload.lifecycle)) {
      router.replace(fallbackHref)
    }
  }, [allowedLifecycles, fallbackHref, payload, ready, router])

  if (!ready) {
    return (
      <AccessStatusShell cardClassName="text-center">
        <p className="text-sm text-[var(--cc-text-muted)]">Loading…</p>
      </AccessStatusShell>
    )
  }

  if (!payload || payload.lifecycle === "not_found") {
    return (
      <AccessStatusShell cardClassName="text-center">
        <h1 className="mb-2 text-xl font-semibold text-[var(--cc-text)]">No access request on file</h1>
        <p className="mb-6 text-sm text-[var(--cc-text-secondary)]">
          Sign in again or submit a new access request to see your status here.
        </p>
        <Button asChild className="rounded-xl">
          <Link href={fallbackHref}>Back to sign in</Link>
        </Button>
      </AccessStatusShell>
    )
  }

  return (
    <AccessStatusShell>
      <AccessRequestStatusPanel
        payload={payload}
        updateHref={updateHref}
        supportHref={supportHref}
        onSignOut={() => {
          clearAccessStatusPayload()
          setPayload(null)
          router.push(fallbackHref)
        }}
      />
    </AccessStatusShell>
  )
}
