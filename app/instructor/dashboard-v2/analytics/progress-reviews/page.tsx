import { redirect } from "next/navigation"

export default function ProgressReviewsPage() {
  redirect("/faculty/dashboard/analytics?section=progress-reviews")
}
