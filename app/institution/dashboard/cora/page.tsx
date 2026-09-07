"use client"

import { Suspense } from "react"
import { InstitutionCoraUsageHub } from "@/components/institution/InstitutionCoraUsageHub"
import { InstitutionModulePage } from "@/components/institution/institution-page"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export default function InstitutionCoraPage() {
  return (
    <Suspense
      fallback={
        <InstitutionModulePage>
          <p className={PORTAL_TEXT_MUTED}>Loading…</p>
        </InstitutionModulePage>
      }
    >
      <InstitutionCoraUsageHub />
    </Suspense>
  )
}
