"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, Shield, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LEGAL_LINKS } from "@/lib/compliance/legal"
import { ACCOUNT_DELETION_POLICY, type AccountKind } from "@/lib/compliance/account-deletion-policy"
import { DeleteAccountDialog } from "@/components/compliance/DeleteAccountDialog"

type Props = {
  accountKind: AccountKind
  authHeaders: HeadersInit
  onDeleted: () => void
}

export function PrivacySecurityPanel({ accountKind, authHeaders, onDeleted }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">Legal</h3>
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[var(--cc-text)] hover:bg-[var(--cc-accent-soft)]/45"
              >
                <span className="inline-flex items-center gap-2">
                  {link.key === "aiAndData" ? <Sparkles className="size-4" /> : <Shield className="size-4" />}
                  {link.label}
                </span>
                <ExternalLink className="size-4 text-[var(--cc-text-muted)]" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">AI &amp; Data</h3>
        <p className="text-sm text-[var(--cc-text-muted)]">
          Cora is designed to minimize personal data sent to external AI providers. Authorized task context and your
          prompts may go to OpenAI or Anthropic; names, emails, and student IDs are not added for personalization alone.
          Conversations are stored on CourseCollab servers. Local teaching memory stays on your device. Instructor
          sharing is off unless you enable it in Cora settings.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--cc-text)]">Delete account</h3>
        <p className="text-sm text-[var(--cc-text-muted)]">{ACCOUNT_DELETION_POLICY.summary}</p>
        <Button type="button" variant="destructive" className="gap-2" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          Delete Account
        </Button>
      </section>

      <DeleteAccountDialog
        open={open}
        onOpenChange={setOpen}
        accountKind={accountKind}
        authHeaders={authHeaders}
        onDeleted={onDeleted}
      />
    </div>
  )
}
