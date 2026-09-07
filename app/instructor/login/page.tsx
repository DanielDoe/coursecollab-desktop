import { redirect } from "next/navigation"

export default function LegacyInstructorLoginRedirect() {
  redirect("/faculty/login")
}
