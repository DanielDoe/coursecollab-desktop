"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Clock, BarChart3, User, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { camperCard, camperHeading, camperBody, camperAccentBullet, camperCta, camperOutlineButton } from "@/lib/summer-camp/camper-ui-theme"
import {
  markCampTrainingEnrolledLocally,
  patchBrowseHubEnrollment,
  postCampTrainingEnroll,
  type BrowseTrainingHub,
} from "@/lib/summer-camp/enroll-client"
import { cn } from "@/lib/utils"

type BrowseHub = BrowseTrainingHub & {
  camps: Array<{
    title: string
    trainings: Array<{
      id: number | null
      slug: string
      title: string
      description: string | null
      available: boolean
      meta: {
        duration: string
        difficulty: string
        outcomes: string[]
        tags: string[]
      }
      faculty: Array<{ name: string; email?: string; job_title?: string | null }>
      enrolled?: boolean
    }>
  }>
}

export default function BrowseTrainingsPage() {
  const router = useRouter()
  const studentDbId = useStudentDatabaseId()
  const { data, loading, setData } = useCampHub<BrowseHub>("browse", { public: true })
  const [enrolling, setEnrolling] = useState<number | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const enroll = async (trainingId: number) => {
    setEnrollError(null)
    if (!studentDbId) {
      setEnrollError("Sign in to enroll in a training.")
      return
    }
    setEnrolling(trainingId)
    try {
      await postCampTrainingEnroll(trainingId, studentDbId)
      markCampTrainingEnrolledLocally(trainingId)
      setData((prev) => (prev ? patchBrowseHubEnrollment(prev, trainingId) : prev))
      router.push(campRoute(`/training/${trainingId}`))
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : "Enrollment failed")
    } finally {
      setEnrolling(null)
    }
  }

  return (
    <CamperPageShell
      icon={BookOpen}
      title="Browse Trainings"
      subtitle="Discover hands-on engineering tracks — AI, robotics, cybersecurity, and more."
      loading={loading}
    >
      {enrollError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{enrollError}</AlertDescription>
        </Alert>
      )}
      {data?.camps?.map((camp) => (
        <section key={camp.title} className="space-y-4">
          <h2 className={camperHeading}>{camp.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {camp.trainings.map((t) => (
              <div key={t.slug} className={camperCard}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={camperHeading}>{t.title}</h3>
                  {!t.available && (
                    <Badge variant="secondary" className="shrink-0">
                      <Lock className="h-3 w-3 mr-1" />
                      Coming Soon
                    </Badge>
                  )}
                </div>
                {t.description && <p className={cn(camperBody, "mt-2")}>{t.description}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className={cn("text-xs flex items-center gap-1", camperBody)}>
                    <Clock className="h-3.5 w-3.5" /> {t.meta.duration}
                  </span>
                  <span className={cn("text-xs flex items-center gap-1", camperBody)}>
                    <BarChart3 className="h-3.5 w-3.5" /> {t.meta.difficulty}
                  </span>
                  {t.faculty?.[0] && (
                    <span className={cn("text-xs flex items-center gap-1", camperBody)}>
                      <User className="h-3.5 w-3.5" /> {t.faculty[0].name}
                    </span>
                  )}
                </div>
                <ul className={cn("mt-3 space-y-1 flex-1", camperBody)}>
                  {t.meta.outcomes.slice(0, 3).map((o) => (
                    <li key={o} className="flex gap-1.5">
                      <span className={camperAccentBullet}>•</span> {o}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {t.meta.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs dark:border-white/20 dark:text-slate-300"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-auto w-full">
                  <div className={cn("mt-6 pt-4 flex flex-wrap items-center justify-end gap-2", camperDivider)}>
                  {t.available && t.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className={camperOutlineButton}
                        asChild
                      >
                        <Link href={campRoute(`/training/${t.id}?preview=1`)}>View</Link>
                      </Button>
                      {t.enrolled ? (
                        <Button size="sm" asChild className={camperCta}>
                          <Link href={campRoute(`/training/${t.id}`)}>Continue training</Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          type="button"
                          className={camperCta}
                          onClick={() => void enroll(t.id!)}
                          disabled={enrolling === t.id}
                        >
                          {enrolling === t.id ? "Enrolling…" : "Enroll"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className={camperOutlineButton}
                    >
                      Notify me when open
                    </Button>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </CamperPageShell>
  )
}
