/** Student stream is the Cora operating layer — always runCoraAgentRuntime. */
import { NextRequest } from "next/server"
import OpenAI from "openai"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import { getCachedResponse, cacheResponse } from "@/lib/ai-cache"
import { isCoraLiteEligible } from "@/lib/cora/credits/economy"
import { getEffectiveMembershipTier, getStudentCoraBalance } from "@/lib/membership"
import { runCoraAgentRuntime } from "@/lib/cora/agent/runtime"
import { buildStudentCoraSession } from "@/lib/cora/security"
import { loadCoraCourseRoutingPolicy } from "@/lib/cora/models/load-course-policy"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { message, context, conversationHistory = [] } = body as {
      message?: string
      context?: { topic?: string }
      conversationHistory?: Array<{ role?: string; content?: string }>
    }
    const studentId = auth.studentDbId

    if (!message || !message.trim()) {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ error: "Message is required" })}\n\n`),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      )
    }

    const uid = studentId != null ? Number(studentId) : NaN
    const hasUser = Number.isFinite(uid) && uid > 0

    const cachedResponse = await getCachedResponse(message, context?.topic)
    if (cachedResponse) {
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ cached: true })}\n\n`))
          const words = cachedResponse.split(" ")
          for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? " " : "")
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
            await new Promise((resolve) => setTimeout(resolve, 30))
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, cached: true })}\n\n`),
          )
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const startTime = Date.now()
          let membershipTier: string | null = null
          let coraLiteMode = false
          if (hasUser) {
            membershipTier = await getEffectiveMembershipTier(uid)
            try {
              const bal = await getStudentCoraBalance(uid)
              if (bal.total <= 0 && isCoraLiteEligible(message)) coraLiteMode = true
            } catch {
              /* keep premium path */
            }
          }

          const studentCourseId = hasUser
            ? (await resolveStudentCourseContextByDbId(uid))?.courseId ?? null
            : null
          const courseRoutingPolicy = await loadCoraCourseRoutingPolicy({ courseId: studentCourseId })
          const studentSession = hasUser
            ? await buildStudentCoraSession({
                studentDbId: uid,
                membershipTier,
              })
            : undefined

          const recentHistory = conversationHistory.slice(-10).map((msg) => ({
            role: msg.role === "student" ? "user" : "assistant",
            content: msg.content || "",
          }))

          const systemPrompt = `You are an expert programming and STEM course tutor. Be clear, encouraging, and educational. Adapt your explanations to the student's course material and question.
              
              ${context?.topic ? `Current topic: ${context.topic}` : ""}`

          const agentResult = await runCoraAgentRuntime({
            openai,
            role: "assistant",
            session: studentSession,
            actor: {
              studentDbId: hasUser ? uid : undefined,
              session: studentSession,
            },
            systemPrompt,
            conversationHistory: recentHistory,
            userMessage: message,
            requestContext: {
              userRole: "student",
              portal: "student",
              message,
              conversationHistory: recentHistory,
              courseId: studentCourseId,
              courseRoutingPolicy,
              coraLiteMode,
              requiresTools: true,
              agenticAction: true,
            },
          })

          const fullResponse = agentResult.content || ""
          const words = fullResponse.split(" ")
          for (let i = 0; i < words.length; i++) {
            const chunk = words[i] + (i < words.length - 1 ? " " : "")
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
          }

          const responseTime = Date.now() - startTime
          let detectedTopic = context?.topic || "General"
          if (!context?.topic && fullResponse.length > 50) {
            const topicKeywords: Record<string, string[]> = {
              Pointers: ["pointer", "address", "dereference", "ptr", "*ptr"],
              Loops: ["loop", "for", "while", "iteration", "iterate"],
              Arrays: ["array", "index", "element", "[]"],
              Functions: ["function", "parameter", "return", "argument"],
              Classes: ["class", "object", "constructor", "member"],
              "Memory Management": ["new", "delete", "malloc", "free", "memory"],
              Inheritance: ["inherit", "base class", "derived", "virtual"],
              Templates: ["template", "generic", "<T>"],
            }
            for (const [topic, keywords] of Object.entries(topicKeywords)) {
              if (
                keywords.some(
                  (kw) =>
                    message.toLowerCase().includes(kw) || fullResponse.toLowerCase().includes(kw),
                )
              ) {
                detectedTopic = topic
                break
              }
            }
          }

          try {
            const conversationRows = (await sql`
              INSERT INTO ai_tutor_conversations (
                student_id, message, response, topic, response_time, created_at
              ) VALUES (
                ${studentId || null}, ${message}, ${fullResponse}, ${detectedTopic}, ${responseTime}, NOW()
              ) RETURNING id
            `) as Array<{ id: number }>
            await cacheResponse(message, fullResponse, detectedTopic)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  topic: detectedTopic,
                  conversationId: conversationRows[0]?.id,
                  cached: false,
                  creditsCharged: agentResult.creditsCharged,
                })}\n\n`,
              ),
            )
          } catch (dbError) {
            console.error("[Stream DB Error]", dbError)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  done: true,
                  topic: detectedTopic,
                  warning: "Response not saved",
                  cached: false,
                })}\n\n`,
              ),
            )
          }

          controller.close()
        } catch (error: unknown) {
          console.error("[Streaming Error]", error)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: error instanceof Error ? error.message : "Failed to generate response",
              })}\n\n`,
            ),
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error: unknown) {
    console.error("[Stream Setup Error]", error)
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Failed to initialize stream" })}\n\n`),
        )
        controller.close()
      },
    })
    return new Response(errorStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }
}
