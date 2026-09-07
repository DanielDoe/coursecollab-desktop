"use client"

import { useState } from "react"
import Link from "next/link"
import { Download, ExternalLink, Eye, Linkedin, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CampCertificatePreview } from "@/components/summer-camp/CampCertificatePreview"
import type { CampCertificateRenderData, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import { buildCertificateVerificationUrl } from "@/lib/summer-camp/certificate-verification-url"

export function CampCertificateStudentActions({
  certId,
  verificationCode,
  linkedinUrl,
  studentDatabaseId,
}: {
  certId: number
  verificationCode: string
  linkedinUrl: string | null
  studentDatabaseId: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [template, setTemplate] = useState<CampCertificateTemplate | null>(null)
  const [data, setData] = useState<CampCertificateRenderData | null>(null)
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : null
  const verifyUrl = buildCertificateVerificationUrl(verificationCode, origin)

  const linkedInHref = (() => {
    if (!linkedinUrl) return null
    try {
      const url = new URL(linkedinUrl)
      if (!url.searchParams.has("certUrl")) {
        url.searchParams.set("certUrl", verifyUrl)
      }
      return url.toString()
    } catch {
      return linkedinUrl
    }
  })()

  const download = () => {
    window.open(
      `/api/summer-camp/certificates/${certId}/download?studentDatabaseId=${studentDatabaseId}`,
      "_blank",
    )
  }

  const view = async () => {
    setOpen(true)
    if (template && data) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/summer-camp/certificates/${certId}/preview?studentDatabaseId=${studentDatabaseId}`,
      )
      if (res.ok) {
        const json = await res.json()
        setTemplate(json.template)
        setData(json.data)
      }
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(verifyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void view()}>
          <Eye className="h-4 w-4 mr-1" />
          View certificate
        </Button>
        <Button size="sm" onClick={download}>
          <Download className="h-4 w-4 mr-1" />
          Download PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copyLink()}>
          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
          {copied ? "Copied" : "Copy verify link"}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/verify/certificate/${verificationCode}`} target="_blank">
            <ExternalLink className="h-4 w-4 mr-1" />
            Verification page
          </Link>
        </Button>
        {linkedInHref && (
          <Button size="sm" variant="outline" asChild>
            <a href={linkedInHref} target="_blank" rel="noopener noreferrer">
              <Linkedin className="h-4 w-4 mr-1" />
              Add to LinkedIn
            </a>
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Your certificate</DialogTitle>
          </DialogHeader>
          {loading || !template || !data ? (
            <p className="text-sm text-slate-500 py-12 text-center">Loading preview…</p>
          ) : (
            <CampCertificatePreview template={template} data={data} className="w-full" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
