import { type NextRequest } from "next/server"
import { postAccountDelete } from "@/lib/compliance/account-delete-http"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  return postAccountDelete(request, "student")
}
