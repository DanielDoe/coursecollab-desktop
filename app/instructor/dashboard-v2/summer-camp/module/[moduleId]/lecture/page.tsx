"use client"

import { useParams } from "next/navigation"
import { CampLectureModuleView } from "@/components/summer-camp/CampLectureModuleView"

export default function InstructorSummerCampModuleLecturePage() {
  const params = useParams()
  const moduleId = params.moduleId as string

  return <CampLectureModuleView moduleId={moduleId} />
}
