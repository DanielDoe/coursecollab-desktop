import Link from "next/link"

export const dynamic = "force-dynamic"

export default function OfficeHoursIndexPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Office hours link</h1>
        <p className="text-sm text-slate-600">
          This page needs your instructor&apos;s personal code in the URL. Scan the door QR code or open the full
          link from your instructor (for example{" "}
          <span className="font-mono text-slate-800">/office-hours/your-code</span>).
        </p>
        <p className="text-xs text-slate-500">
          Visiting <span className="font-mono">/office-hours</span> alone is not a valid link.
        </p>
        <Link href="/" className="inline-block text-sm font-medium text-indigo-600 hover:underline">
          Go to CourseCollab home
        </Link>
      </div>
    </main>
  )
}
