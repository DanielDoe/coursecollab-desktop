/**
 * Schedule adjustment workflow tests.
 * Run: npx tsx --test lib/schedule-adjustment/availability-analysis.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  computeCandidates,
  computeSlotHeatmap,
  consensusCategoryForPercentage,
  parseAvailabilityData,
} from "@/lib/schedule-adjustment/availability-analysis"
import {
  assertTransition,
  autoAdvanceAfterPollClose,
  canTransition,
} from "@/lib/schedule-adjustment/status"
import { isStudentAvailableForWindow, slotKey } from "@/lib/schedule-adjustment/time-slots"
import { canFinalizeConsent, validateAvailabilityWindow } from "@/lib/schedule-adjustment/validate"
import { applyCancelledDatesToEvents, pickVersionForDate } from "@/lib/schedule-adjustment/calendar-versions"
import { pollColumns } from "@/lib/schedule-adjustment/poll-scope"

describe("schedule adjustment status", () => {
  it("allows draft to collecting availability", () => {
    assert.equal(canTransition("DRAFT", "COLLECTING_AVAILABILITY"), true)
    assert.doesNotThrow(() => assertTransition("DRAFT", "COLLECTING_AVAILABILITY"))
  })

  it("blocks skipping department approval", () => {
    assert.equal(canTransition("REVIEWING_RESULTS", "COLLECTING_CONSENT"), false)
  })

  it("auto closes poll after deadline", () => {
    const past = new Date("2026-09-01T12:00:00Z")
    const ends = new Date("2026-09-01T10:00:00Z")
    assert.equal(autoAdvanceAfterPollClose(past, ends, "COLLECTING_AVAILABILITY"), "AVAILABILITY_CLOSED")
  })
})

describe("availability analysis", () => {
  it("computes unanimous candidate correctly", () => {
    const students = [
      {
        studentId: 1,
        responded: true,
        slots: {
          [slotKey("TU", "15:00:00")]: "available" as const,
          [slotKey("TU", "15:30:00")]: "available" as const,
        },
      },
      {
        studentId: 2,
        responded: true,
        slots: {
          [slotKey("TU", "15:00:00")]: "available" as const,
          [slotKey("TU", "15:30:00")]: "available" as const,
        },
      },
    ]

    const results = computeCandidates(
      {
        candidateDays: ["TU"],
        candidateStartTime: "15:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
      },
      students,
      2,
    )

    assert.equal(results[0]?.availableCount, 2)
    assert.equal(results[0]?.agreementPercentage, 100)
    assert.equal(results[0]?.consensusCategory, "unanimous")
  })

  it("counts non-responders separately", () => {
    const students = [
      {
        studentId: 1,
        responded: true,
        slots: {
          [slotKey("WE", "10:00:00")]: "available" as const,
          [slotKey("WE", "10:30:00")]: "available" as const,
        },
      },
      { studentId: 2, responded: false, slots: {} },
    ]
    const results = computeCandidates(
      {
        candidateDays: ["WE"],
        candidateStartTime: "10:00:00",
        candidateEndTime: "12:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
      },
      students,
      2,
    )
    assert.equal(results[0]?.nonResponseCount, 1)
    assert.equal(results[0]?.availableCount, 1)
    assert.equal(results[0]?.agreementPercentage, 50)
  })

  it("never treats preferred as replacing availability requirement", () => {
    const window = [slotKey("FR", "09:00:00"), slotKey("FR", "09:30:00")]
    const slots = {
      [slotKey("FR", "09:00:00")]: "preferred" as const,
      [slotKey("FR", "09:30:00")]: "unavailable" as const,
    }
    assert.equal(isStudentAvailableForWindow(slots, window).available, false)
  })

  it("labels consensus categories", () => {
    assert.equal(consensusCategoryForPercentage(100), "unanimous")
    assert.equal(consensusCategoryForPercentage(95), "strong_consensus")
    assert.equal(consensusCategoryForPercentage(90), "high_availability")
    assert.equal(consensusCategoryForPercentage(80), "partial")
  })

  it("parses availability payloads safely", () => {
    assert.equal(
      parseAvailabilityData({ slots: { "MO-09:00": "available", bad: "nope" } }).slots["MO-09:00"],
      "available",
    )
  })

  it("builds per-slot heatmap counts for divergent responses", () => {
    const timeSlots = ["15:00:00", "15:30:00", "16:00:00"]
    const students = [
      {
        studentId: 1,
        responded: true,
        slots: {
          [slotKey("TU", "15:00:00")]: "available" as const,
          [slotKey("TU", "15:30:00")]: "available" as const,
        },
      },
      {
        studentId: 2,
        responded: true,
        slots: {
          [slotKey("TU", "16:00:00")]: "available" as const,
        },
      },
      {
        studentId: 3,
        responded: true,
        slots: {
          [slotKey("WE", "15:00:00")]: "available" as const,
          [slotKey("WE", "15:30:00")]: "available" as const,
        },
      },
    ]

    const heatmap = computeSlotHeatmap(["TU", "WE"], timeSlots, students)
    assert.equal(heatmap[slotKey("TU", "15:00:00")]?.available, 1)
    assert.equal(heatmap[slotKey("TU", "16:00:00")]?.available, 1)
    assert.equal(heatmap[slotKey("WE", "15:00:00")]?.available, 1)
    assert.equal(heatmap[slotKey("TU", "15:30:00")]?.noMark, 2)
  })

  it("ranks meeting windows when students pick different slots", () => {
    const students = [
      {
        studentId: 1,
        responded: true,
        slots: {
          [slotKey("TU", "15:00:00")]: "available" as const,
          [slotKey("TU", "15:30:00")]: "available" as const,
        },
      },
      {
        studentId: 2,
        responded: true,
        slots: {
          [slotKey("TU", "15:00:00")]: "available" as const,
          [slotKey("TU", "15:30:00")]: "available" as const,
        },
      },
      {
        studentId: 3,
        responded: true,
        slots: {
          [slotKey("TU", "16:00:00")]: "available" as const,
          [slotKey("TU", "16:30:00")]: "available" as const,
        },
      },
    ]

    const results = computeCandidates(
      {
        candidateDays: ["TU"],
        candidateStartTime: "15:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
      },
      students,
      3,
    )

    assert.equal(results[0]?.startTime, "15:00:00")
    assert.equal(results[0]?.availableCount, 2)
    assert.equal(results[1]?.startTime, "16:00:00")
    assert.equal(results[1]?.availableCount, 1)
  })
})

describe("consent invalidation policy", () => {
  it("requires full threshold at 100%", () => {
    const total = 40
    const agreed = 39
    const threshold = 100
    const required = Math.ceil((total * threshold) / 100)
    assert.equal(agreed >= required, false)
  })
})

describe("prohibited transitions", () => {
  it("blocks draft to finalized", () => {
    assert.equal(canTransition("DRAFT", "FINALIZED"), false)
  })
  it("blocks collecting availability to finalized", () => {
    assert.equal(canTransition("COLLECTING_AVAILABILITY", "FINALIZED"), false)
  })
  it("blocks awaiting approval to consent", () => {
    assert.equal(canTransition("AWAITING_DEPARTMENT_APPROVAL", "COLLECTING_CONSENT"), false)
  })
  it("blocks cancelled to finalized", () => {
    assert.equal(canTransition("CANCELLED", "FINALIZED"), false)
  })
  it("allows cancelled to reopen availability", () => {
    assert.equal(canTransition("CANCELLED", "COLLECTING_AVAILABILITY"), true)
  })
  it("blocks finalized to draft", () => {
    assert.equal(canTransition("FINALIZED", "DRAFT"), false)
  })
  it("blocks consent complete to finalized without ready step", () => {
    assert.equal(canTransition("CONSENT_COMPLETE", "FINALIZED"), false)
  })
})

describe("40-student availability percentages", () => {
  function buildStudents(available: number, unavailable: number, missing: number, day = "TU", start = "15:00:00") {
    const students = []
    let id = 1
    for (let i = 0; i < available; i++) {
      students.push({
        studentId: id++,
        responded: true,
        slots: {
          [slotKey(day, start)]: "available" as const,
          [slotKey(day, "15:30:00")]: "available" as const,
        },
      })
    }
    for (let i = 0; i < unavailable; i++) {
      students.push({
        studentId: id++,
        responded: true,
        slots: {
          [slotKey(day, start)]: "unavailable" as const,
          [slotKey(day, "15:30:00")]: "unavailable" as const,
        },
      })
    }
    for (let i = 0; i < missing; i++) {
      students.push({ studentId: id++, responded: false, slots: {} })
    }
    return students
  }

  const window = {
    candidateDays: ["TU"],
    candidateStartTime: "15:00:00",
    candidateEndTime: "17:00:00",
    meetingDurationMinutes: 60,
    slotIncrementMinutes: 30,
  }

  it("scores 40/40 as 100 percent unanimous", () => {
    const results = computeCandidates(window, buildStudents(40, 0, 0), 40)
    assert.equal(results[0]?.agreementPercentage, 100)
    assert.equal(results[0]?.consensusCategory, "unanimous")
  })

  it("scores 39/40 as 97.5 percent strong consensus", () => {
    const results = computeCandidates(window, buildStudents(39, 1, 0), 40)
    assert.equal(results[0]?.agreementPercentage, 97.5)
    assert.equal(results[0]?.consensusCategory, "strong_consensus")
  })

  it("scores 36/40 as 90 percent high availability", () => {
    const results = computeCandidates(window, buildStudents(36, 4, 0), 40)
    assert.equal(results[0]?.agreementPercentage, 90)
    assert.equal(results[0]?.consensusCategory, "high_availability")
  })

  it("uses enrolled denominator including non-responders", () => {
    const results = computeCandidates(window, buildStudents(30, 5, 5), 40)
    assert.equal(results[0]?.availableCount, 30)
    assert.equal(results[0]?.unavailableCount, 5)
    assert.equal(results[0]?.nonResponseCount, 5)
    assert.equal(results[0]?.agreementPercentage, 75)
    assert.equal(results[0]?.consensusCategory, "partial")
  })

  it("does not count a 60 minute window from a single 30 minute slot", () => {
    const students = [
      {
        studentId: 1,
        responded: true,
        slots: { [slotKey("TU", "15:00:00")]: "available" as const },
      },
    ]
    const results = computeCandidates(window, students, 1)
    assert.equal(results[0]?.availableCount, 0)
    assert.equal(results[0]?.agreementPercentage, 0)
  })
})

describe("one-off makeup poll", () => {
  it("requires a missed class date and makeup dates", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    assert.equal(
      validateAvailabilityWindow({
        pollKind: "one_off",
        candidateStartTime: "08:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
        availabilityEndsAt: future,
        candidateDays: [],
        candidateDates: ["2026-09-10"],
      }),
      "Missed class date is required",
    )
    assert.equal(
      validateAvailabilityWindow({
        pollKind: "one_off",
        missedClassDate: "2026-09-08",
        candidateStartTime: "08:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
        availabilityEndsAt: future,
        candidateDays: [],
        candidateDates: [],
      }),
      "Add at least one makeup date for students to choose from",
    )
  })

  it("scores availability on a specific date column", () => {
    const date = "2026-09-10"
    const results = computeCandidates(
      {
        pollKind: "one_off",
        candidateDays: [],
        candidateDates: [date],
        candidateStartTime: "15:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
      },
      [
        {
          studentId: 1,
          responded: true,
          slots: {
            [slotKey(date, "15:00:00")]: "available",
            [slotKey(date, "15:30:00")]: "available",
          },
        },
      ],
      1,
    )
    assert.equal(results[0]?.dayOfWeek, date)
    assert.equal(results[0]?.agreementPercentage, 100)
  })
})

describe("availability window validation", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString()

  it("rejects end before start", () => {
    assert.equal(
      validateAvailabilityWindow({
        candidateStartTime: "17:00:00",
        candidateEndTime: "08:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
        availabilityEndsAt: future,
        candidateDays: ["MO"],
      }),
      "End time must be after start time",
    )
  })

  it("rejects meeting longer than the window", () => {
    assert.equal(
      validateAvailabilityWindow({
        candidateStartTime: "08:00:00",
        candidateEndTime: "08:30:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
        availabilityEndsAt: future,
        candidateDays: ["MO"],
      }),
      "Meeting duration cannot be longer than the availability window",
    )
  })

  it("rejects invalid slot increments", () => {
    assert.equal(
      validateAvailabilityWindow({
        candidateStartTime: "08:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 20,
        availabilityEndsAt: future,
        candidateDays: ["MO"],
      }),
      "Slot duration must be 15, 30, or 60 minutes",
    )
  })
})

describe("consent finalization gate", () => {
  it("blocks 39 of 40 at 100 percent", () => {
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 39, declined: 0, pending: 1, thresholdPercent: 100 }),
      false,
    )
  })
  it("blocks any decline at 100 percent", () => {
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 39, declined: 1, pending: 0, thresholdPercent: 100 }),
      false,
    )
  })
  it("allows 40 of 40", () => {
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 40, declined: 0, pending: 0, thresholdPercent: 100 }),
      true,
    )
  })
  it("allows threshold when enough have agreed even with pending responses", () => {
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 36, declined: 0, pending: 4, thresholdPercent: 90 }),
      true,
    )
  })
  it("allows 80 percent of 44 without waiting for non-responders", () => {
    assert.equal(
      canFinalizeConsent({ total: 44, agreed: 36, declined: 0, pending: 8, thresholdPercent: 80 }),
      true,
    )
  })
  it("requires a strict majority at 50 percent (21 of 40, not 20)", () => {
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 20, declined: 0, pending: 20, thresholdPercent: 50 }),
      false,
    )
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 21, declined: 0, pending: 19, thresholdPercent: 50 }),
      true,
    )
  })
  it("requires 3 of 5 at 50 percent (more than half)", () => {
    assert.equal(
      canFinalizeConsent({ total: 5, agreed: 2, declined: 0, pending: 3, thresholdPercent: 50 }),
      false,
    )
    assert.equal(
      canFinalizeConsent({ total: 5, agreed: 3, declined: 0, pending: 2, thresholdPercent: 50 }),
      true,
    )
  })
  it("rejects a 0 percent threshold with zero signatures", () => {
    assert.equal(
      canFinalizeConsent({ total: 40, agreed: 0, declined: 0, pending: 0, thresholdPercent: 0 }),
      false,
    )
  })
})

describe("weekend poll days", () => {
  it("accepts Saturday and Sunday candidate days", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    assert.equal(
      validateAvailabilityWindow({
        candidateStartTime: "08:00:00",
        candidateEndTime: "17:00:00",
        meetingDurationMinutes: 60,
        slotIncrementMinutes: 30,
        availabilityEndsAt: future,
        candidateDays: ["SA", "SU"],
      }),
      null,
    )
  })
  it("includes Saturday in poll columns", () => {
    assert.deepEqual(pollColumns({ pollKind: "recurring", candidateDays: ["SA"] }), ["SA"])
  })
})

describe("cancelled calendar dates", () => {
  it("drops events on cancelled attendance days", () => {
    const keep = new Date(2026, 8, 8, 13, 0, 0).toISOString()
    const drop = new Date(2026, 8, 10, 13, 0, 0).toISOString()
    const kept = applyCancelledDatesToEvents(
      [
        { start_time: keep, title: "keep" },
        { start_time: drop, title: "drop" },
      ],
      ["2026-09-10"],
    )
    assert.equal(kept.length, 1)
    assert.equal(kept[0]?.title, "keep")
  })
})

describe("calendar version selection", () => {
  const versions = [
    {
      meetingType: "lecture",
      schedule: { dayCodes: ["TU"], startHour: 13, startMinute: 0, endHour: 14, endMinute: 50, raw: "old" },
      scheduleText: "Tuesday — 1:00 PM–2:50 PM",
      effectiveFrom: "2000-01-01",
      effectiveUntil: "2026-09-07",
    },
    {
      meetingType: "lecture",
      schedule: { dayCodes: ["TU"], startHour: 15, startMinute: 0, endHour: 16, endMinute: 0, raw: "new" },
      scheduleText: "Tuesday — 3:00 PM–4:00 PM",
      effectiveFrom: "2026-09-08",
      effectiveUntil: null,
    },
  ]

  it("keeps the original time before the effective date", () => {
    const picked = pickVersionForDate(versions, new Date(2026, 8, 1), "lecture")
    assert.equal(picked?.schedule.raw, "old")
  })

  it("uses the new time on and after the effective date", () => {
    const picked = pickVersionForDate(versions, new Date(2026, 8, 8), "lecture")
    assert.equal(picked?.schedule.raw, "new")
    const later = pickVersionForDate(versions, new Date(2026, 8, 15), "lecture")
    assert.equal(later?.schedule.raw, "new")
  })
})

