import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json({
    success: true,
    sent: 0,
    message: "Donation reminders are disabled. Students upgrade through Explorer or Trailblazer.",
  })
}
