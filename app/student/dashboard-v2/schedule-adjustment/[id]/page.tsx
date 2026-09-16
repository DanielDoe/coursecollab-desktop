import { StudentScheduleAdjustmentPanel } from "@/components/schedule-adjustment/StudentScheduleAdjustmentPanel"

export default async function StudentScheduleAdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <StudentScheduleAdjustmentPanel requestId={Number(id)} />
}
