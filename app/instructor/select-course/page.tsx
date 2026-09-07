import { redirect } from "next/navigation"

export default function LegacyInstructorSelectCourseRedirect() {
  redirect("/faculty/select-course")
}
