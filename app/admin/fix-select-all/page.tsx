import { SelectAllQuestionFixer } from "@/components/select-all-question-fixer"
import { AdminHeader } from "@/components/admin-header"

export default function FixSelectAllPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="container mx-auto py-8 px-4">
        <SelectAllQuestionFixer />
      </main>
    </div>
  )
}
