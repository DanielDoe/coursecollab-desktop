import { redirect } from "next/navigation"

/** Old role chooser — student and faculty login start from the landing CTAs. */
export default function AuthWelcomePage() {
  redirect("/student/login")
}
