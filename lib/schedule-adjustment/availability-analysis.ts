import type {
  AvailabilityData,
  AvailabilitySlotState,
  ConsensusCategory,
} from "@/lib/schedule-adjustment/types"
import {
  isCandidateBlocked,
  type InstructorTeachingWindow,
} from "@/lib/schedule-adjustment/instructor-busy-blocks"
import {
  generateTimeSlots,
  isStudentAvailableForWindow,
  parseTimeToMinutes,
  slotKey,
  slotsForMeetingWindow,
} from "@/lib/schedule-adjustment/time-slots"

export type CandidateInput = {
  pollKind?: "recurring" | "one_off"
  candidateDays: string[]
  candidateDates?: string[]
  candidateStartTime: string
  candidateEndTime: string
  meetingDurationMinutes: number
  slotIncrementMinutes: number
  /** Instructor teaching blocks — overlapping start times are excluded from results. */
  instructorBusyWindows?: InstructorTeachingWindow[]
}

export type StudentAvailabilityEntry = {
  studentId: number
  slots: Record<string, AvailabilitySlotState>
  responded: boolean
}

export type ComputedCandidate = {
  dayOfWeek: string
  startTime: string
  endTime: string
  availableCount: number
  unavailableCount: number
  nonResponseCount: number
  preferredCount: number
  agreementPercentage: number
  consensusCategory: ConsensusCategory
  availableStudentIds: number[]
  unavailableStudentIds: number[]
  noResponseStudentIds: number[]
}

export function consensusCategoryForPercentage(pct: number): ConsensusCategory {
  if (pct >= 100) return "unanimous"
  if (pct >= 95) return "strong_consensus"
  if (pct >= 90) return "high_availability"
  return "partial"
}

export function computeCandidates(
  input: CandidateInput,
  students: StudentAvailabilityEntry[],
  totalEnrolled: number,
): ComputedCandidate[] {
  const results: ComputedCandidate[] = []
  const increment = input.slotIncrementMinutes
  const duration = input.meetingDurationMinutes
  const dayStart = parseTimeToMinutes(input.candidateStartTime)
  const dayEnd = parseTimeToMinutes(input.candidateEndTime)

  const columns =
    input.pollKind === "one_off" && input.candidateDates?.length
      ? input.candidateDates
      : input.candidateDays

  for (const day of columns) {
    const startSlots = generateTimeSlots(
      input.candidateStartTime,
      input.candidateEndTime,
      increment,
    )

    for (const startTime of startSlots) {
      const startMins = parseTimeToMinutes(startTime)
      const endMins = startMins + duration
      if (endMins > dayEnd) continue

      if (
        input.instructorBusyWindows?.length &&
        isCandidateBlocked(day, startTime, duration, input.instructorBusyWindows)
      ) {
        continue
      }

      const endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}:00`
      const windowKeys = slotsForMeetingWindow(day, startTime, duration, increment)

      let availableCount = 0
      let unavailableCount = 0
      let nonResponseCount = 0
      let preferredCount = 0
      const availableStudentIds: number[] = []
      const unavailableStudentIds: number[] = []
      const noResponseStudentIds: number[] = []

      for (const student of students) {
        if (!student.responded) {
          nonResponseCount++
          noResponseStudentIds.push(student.studentId)
          continue
        }
        const { available, preferredCount: pref } = isStudentAvailableForWindow(
          student.slots,
          windowKeys,
        )
        if (available) {
          availableCount++
          preferredCount += pref
          availableStudentIds.push(student.studentId)
        } else {
          unavailableCount++
          unavailableStudentIds.push(student.studentId)
        }
      }

      const agreementPercentage =
        totalEnrolled > 0 ? Math.round((availableCount / totalEnrolled) * 1000) / 10 : 0

      results.push({
        dayOfWeek: day,
        startTime,
        endTime,
        availableCount,
        unavailableCount,
        nonResponseCount,
        preferredCount,
        agreementPercentage,
        consensusCategory: consensusCategoryForPercentage(agreementPercentage),
        availableStudentIds,
        unavailableStudentIds,
        noResponseStudentIds,
      })
    }
  }

  return results.sort((a, b) => {
    if (b.agreementPercentage !== a.agreementPercentage) {
      return b.agreementPercentage - a.agreementPercentage
    }
    if (b.preferredCount !== a.preferredCount) {
      return b.preferredCount - a.preferredCount
    }
    return a.startTime.localeCompare(b.startTime)
  })
}

export function parseAvailabilityData(raw: unknown): AvailabilityData {
  if (!raw || typeof raw !== "object") return { slots: {} }
  const obj = raw as { slots?: Record<string, string> }
  const slots: Record<string, AvailabilitySlotState> = {}
  if (obj.slots && typeof obj.slots === "object") {
    for (const [k, v] of Object.entries(obj.slots)) {
      if (v === "available" || v === "unavailable" || v === "preferred") {
        slots[k] = v
      }
    }
  }
  return { slots }
}

export type HeatmapCell = {
  day: string
  time: string
  availableCount: number
  totalEnrolled: number
  label: string
}

export type SlotHeatmapCell = {
  available: number
  preferred: number
  unavailable: number
  noMark: number
}

export type SlotHeatmap = Record<string, SlotHeatmapCell>

/** Per grid cell: how many responders marked each slot (not full meeting windows). */
export function computeSlotHeatmap(
  candidateDays: string[],
  timeSlots: string[],
  students: StudentAvailabilityEntry[],
): SlotHeatmap {
  const heatmap: SlotHeatmap = {}
  for (const day of candidateDays) {
    for (const time of timeSlots) {
      heatmap[slotKey(day, time)] = { available: 0, preferred: 0, unavailable: 0, noMark: 0 }
    }
  }

  for (const student of students) {
    if (!student.responded) continue
    for (const day of candidateDays) {
      for (const time of timeSlots) {
        const key = slotKey(day, time)
        const cell = heatmap[key]
        if (!cell) continue
        const status = student.slots[key]
        if (status === "available") cell.available++
        else if (status === "preferred") cell.preferred++
        else if (status === "unavailable") cell.unavailable++
        else cell.noMark++
      }
    }
  }
  return heatmap
}

export function buildHeatmapFromCandidates(
  candidates: ComputedCandidate[],
  totalEnrolled: number,
  slotIncrementMinutes: number,
): HeatmapCell[] {
  const byKey = new Map<string, ComputedCandidate>()
  for (const c of candidates) {
    byKey.set(`${c.dayOfWeek}-${c.startTime}`, c)
  }
  return [...byKey.values()].map((c) => ({
    day: c.dayOfWeek,
    time: c.startTime,
    availableCount: c.availableCount,
    totalEnrolled,
    label: `${c.availableCount} of ${totalEnrolled} available`,
  }))
}
