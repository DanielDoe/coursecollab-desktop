import { redirect } from "next/navigation"

/** Legacy hub — student login (school picker, then credentials). */
export default function LoginHubPage() {
  redirect("/student/login")
}
