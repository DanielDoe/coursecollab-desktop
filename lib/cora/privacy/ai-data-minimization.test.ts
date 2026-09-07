/**
 * Run: npx tsx --test lib/cora/privacy/ai-data-minimization.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildAssessmentFeedbackExternalPayload,
  minimizeStudentContextForExternalAi,
  redactPiiFromText,
  sanitizeMessagesForExternalAi,
} from "./ai-data-minimization"

describe("Cora external AI minimization", () => {
  it("redacts emails and internal id patterns", () => {
    const out = redactPiiFromText("Contact dmdoe@cougarnet.uh.edu student_id=570")
    assert.match(out, /\[redacted-email\]/)
    assert.match(out, /\[redacted-id\]/)
    assert.doesNotMatch(out, /dmdoe@cougarnet/)
  })

  it("strips student identity from context snapshots", () => {
    const minimized = minimizeStudentContextForExternalAi(
      {
        profile: {},
        account: {
          studentDbId: 570,
          studentCode: "P00123456",
          fullName: "Alex Student",
          section: "ECE2202P01",
          courseCode: "ECE2202",
          courseTitle: "Circuits I",
        },
        strugglingTopics: ["Kirchhoff"],
        strengths: ["Ohm's law"],
        practiceAttempts: [],
        playgroundResults: [],
        quizAttempts: [],
        codebenchSubmissions: [],
        lectureProgress: [],
        topicMastery: [],
        calendarEvents: [],
        upcomingAssessments: [],
        missedDeadlines: [],
        notifications: [{ id: 1, title: "Hi" }],
        knowledgeGraph: { nodes: [], edges: [] } as never,
        summary: { totalQuizAttempts: 3 },
        syncedAt: new Date().toISOString(),
      },
      { privacy: { useLearningContext: true, personalizedLearning: true } },
    )
    assert.equal(minimized.account?.fullName, undefined)
    assert.equal(minimized.account?.studentDbId, undefined)
    assert.equal(minimized.account?.studentCode, undefined)
    assert.equal(minimized.notifications?.length, 0)
    assert.deepEqual(minimized.strugglingTopics, ["Kirchhoff"])
  })

  it("honors useLearningContext off", () => {
    const minimized = minimizeStudentContextForExternalAi(
      {
        profile: {},
        strugglingTopics: ["RC circuits"],
        strengths: [],
        practiceAttempts: [{ score: 1 }],
        playgroundResults: [],
        quizAttempts: [],
        codebenchSubmissions: [],
        lectureProgress: [],
        topicMastery: [],
        calendarEvents: [],
        upcomingAssessments: [{ id: "1", title: "Quiz 3", type: "quiz", dueDate: null, opensAt: null, status: "open" }],
        missedDeadlines: [],
        notifications: [],
        knowledgeGraph: undefined,
        summary: {},
        syncedAt: new Date().toISOString(),
      },
      { privacy: { useLearningContext: false, personalizedLearning: false } },
    )
    assert.deepEqual(minimized.strugglingTopics, [])
    assert.deepEqual(minimized.upcomingAssessments, [])
    assert.deepEqual(minimized.practiceAttempts, [])
  })

  it("builds assessment feedback without identity fields", () => {
    const payload = buildAssessmentFeedbackExternalPayload({
      questionText: "Find Vx",
      studentResponse: "Vx = 3V",
      rubricOrContext: "Show KVL",
    })
    assert.equal(payload.questionText, "Find Vx")
    assert.equal("studentName" in payload, false)
  })

  it("sanitizes message arrays", () => {
    const out = sanitizeMessagesForExternalAi([
      { role: "user", content: "Email me at test@example.com" },
    ])
    assert.match(out[0].content, /\[redacted-email\]/)
  })

  it("preserves tool_calls and tool_call_id for agent rounds", () => {
    const toolCalls = [
      {
        id: "call_1",
        type: "function",
        function: { name: "get_calendar", arguments: "{}" },
      },
    ]
    const out = sanitizeMessagesForExternalAi([
      { role: "assistant", content: "", tool_calls: toolCalls },
      {
        role: "tool",
        tool_call_id: "call_1",
        content: "Events: none. Contact test@example.com",
      },
    ])
    assert.deepEqual(out[0].tool_calls, toolCalls)
    assert.equal(out[1].tool_call_id, "call_1")
    assert.match(out[1].content, /\[redacted-email\]/)
  })
})
