import { NextResponse } from "next/server"
import { IOS_PURCHASE_POLICY } from "@/lib/compliance/ios-purchase-policy"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(IOS_PURCHASE_POLICY)
}
