"use client"

import Link from "next/link"
import { LifeBuoy, Mail, MessageCircle, Map } from "lucide-react"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { campRoute } from "@/lib/summer-camp/camper-nav"

export default function CampSupportPage() {
  return (
    <CamperPageShell
      icon={LifeBuoy}
      title="Support"
      subtitle="Get help with your camp experience, accounts, and technical issues."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={campRoute("/discussions")}
          className="rounded-xl border border-slate-200/80 dark:border-white/10 p-5 hover:border-violet-500/40 transition-colors"
        >
          <MessageCircle className="h-6 w-6 text-emerald-500 mb-2" />
          <p className="font-semibold">Discussions & Help</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ask instructors on any module step.</p>
        </Link>
        <Link
          href={campRoute("/roadmap")}
          className="rounded-xl border border-slate-200/80 dark:border-white/10 p-5 hover:border-violet-500/40 transition-colors"
        >
          <Map className="h-6 w-6 text-emerald-500 mb-2" />
          <p className="font-semibold">Learning Roadmap</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">See what to work on next.</p>
        </Link>
        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 p-5 sm:col-span-2">
          <Mail className="h-6 w-6 text-violet-500 mb-2" />
          <p className="font-semibold">Account & access issues</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Contact your camp coordinator at{" "}
            <a href="mailto:dmdoe@pvamu.edu" className="text-violet-600 hover:underline">
              dmdoe@pvamu.edu
            </a>
          </p>
        </div>
      </div>
    </CamperPageShell>
  )
}
