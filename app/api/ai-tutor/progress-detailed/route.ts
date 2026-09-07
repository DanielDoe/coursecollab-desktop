import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const studentIdNum = parseInt(studentId)

    // 1. Concept Mastery Map (from AI tutor conversations)
    let conceptMastery: any[] = []
    try {
      conceptMastery = await sql`
        SELECT 
          topic,
          mastery_percentage,
          questions_asked,
          accuracy_percentage,
          last_practiced
        FROM ai_tutor_topic_mastery 
        WHERE student_id = ${studentIdNum}
        ORDER BY mastery_percentage DESC
      `
    } catch (error: any) {
      // Table might not exist, return empty array
    }

    // 2. Reasoning Skill Score (analyze conversation quality)
    let reasoningScore = 0
    let reasoningHistory: any[] = []
    try {
      const conversations = await sql`
        SELECT 
          message,
          response,
          response_time,
          satisfaction_score,
          created_at,
          topic
        FROM ai_tutor_conversations
        WHERE student_id = ${studentIdNum}
        ORDER BY created_at DESC
        LIMIT 100
      `
      
      // Calculate reasoning score based on:
      // - Response time (faster = better understanding)
      // - Satisfaction score (higher = better explanations)
      // - Question depth (longer questions = deeper thinking)
      if (conversations.length > 0) {
        const avgResponseTime = conversations.reduce((sum: number, c: any) => sum + (c.response_time || 0), 0) / conversations.length
        const avgSatisfaction = conversations.reduce((sum: number, c: any) => sum + (c.satisfaction_score || 0), 0) / conversations.length
        const avgQuestionLength = conversations.reduce((sum: number, c: any) => sum + (c.message?.length || 0), 0) / conversations.length
        
        // Normalize scores (0-100)
        const responseTimeScore = Math.max(0, 100 - (avgResponseTime / 100)) // Lower response time = higher score
        const satisfactionScore = avgSatisfaction * 20 // 0-5 scale to 0-100
        const depthScore = Math.min(100, avgQuestionLength / 5) // Longer questions = deeper thinking
        
        reasoningScore = Math.round((responseTimeScore + satisfactionScore + depthScore) / 3)
        
        // Get weekly history
        const weeklyConversations = conversations.filter((c: any) => {
          const daysAgo = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)
          return daysAgo <= 7
        })
        
        if (weeklyConversations.length > 0) {
          const weeklyAvgResponseTime = weeklyConversations.reduce((sum: number, c: any) => sum + (c.response_time || 0), 0) / weeklyConversations.length
          const weeklyAvgSatisfaction = weeklyConversations.reduce((sum: number, c: any) => sum + (c.satisfaction_score || 0), 0) / weeklyConversations.length
          const weeklyAvgQuestionLength = weeklyConversations.reduce((sum: number, c: any) => sum + (c.message?.length || 0), 0) / weeklyConversations.length
          
          const weeklyResponseTimeScore = Math.max(0, 100 - (weeklyAvgResponseTime / 100))
          const weeklySatisfactionScore = weeklyAvgSatisfaction * 20
          const weeklyDepthScore = Math.min(100, weeklyAvgQuestionLength / 5)
          
          const weeklyReasoningScore = Math.round((weeklyResponseTimeScore + weeklySatisfactionScore + weeklyDepthScore) / 3)
          reasoningHistory.push({ week: "This Week", score: weeklyReasoningScore })
        }
      }
    } catch (error: any) {
      // Table might not exist
    }

    // 3. Misconception Tracker (from conversation analysis)
    let misconceptions: any[] = []
    try {
      const conversations = await sql`
        SELECT message, response, topic, created_at
        FROM ai_tutor_conversations
        WHERE student_id = ${studentIdNum}
        ORDER BY created_at DESC
        LIMIT 200
      `
      
      // Simple pattern matching for common misconceptions
      const misconceptionPatterns = [
        { pattern: /off.?by.?one|index.*out|bound/i, name: "Off-by-one errors", topic: "Arrays/Loops" },
        { pattern: /memory.*leak|delete|free|malloc/i, name: "Memory management", topic: "Memory" },
        { pattern: /while.*loop|infinite|never.*stop/i, name: "While loop misuse", topic: "Loops" },
        { pattern: /pointer.*confusion|dereference|address/i, name: "Pointer confusion", topic: "Pointers" },
        { pattern: /array.*index|subscript|out.*range/i, name: "Array indexing errors", topic: "Arrays" },
      ]
      
      const misconceptionCounts: Record<string, number> = {}
      
      conversations.forEach((conv: any) => {
        const message = (conv.message || "").toLowerCase()
        misconceptionPatterns.forEach(({ pattern, name, topic }) => {
          if (pattern.test(message)) {
            const key = `${name}|${topic}`
            misconceptionCounts[key] = (misconceptionCounts[key] || 0) + 1
          }
        })
      })
      
      misconceptions = Object.entries(misconceptionCounts)
        .map(([key, count]) => {
          const [name, topic] = key.split("|")
          return { name, topic, occurrences: count, severity: count > 3 ? "severe" : count > 1 ? "moderate" : "minor" }
        })
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 10)
    } catch (error: any) {
      // Table might not exist
    }

    // 4. Learning Behavior Insights
    let behaviorInsights: any = {}
    try {
      const conversations = await sql`
        SELECT 
          message,
          response,
          response_time,
          created_at,
          topic
        FROM ai_tutor_conversations
        WHERE student_id = ${studentIdNum}
        ORDER BY created_at DESC
        LIMIT 100
      `
      
      if (conversations.length > 0) {
        const avgQuestionLength = conversations.reduce((sum: number, c: any) => sum + (c.message?.length || 0), 0) / conversations.length
        const followUpQuestions = conversations.filter((c: any, i: number) => {
          if (i === 0) return false
          const timeDiff = new Date(c.created_at).getTime() - new Date(conversations[i - 1].created_at).getTime()
          return timeDiff < 5 * 60 * 1000 // Within 5 minutes
        }).length
        
        const confusionMarkers = conversations.filter((c: any) => {
          const msg = (c.message || "").toLowerCase()
          return /confused|don't understand|unclear|help|stuck/i.test(msg)
        }).length
        
        behaviorInsights = {
          avgQuestionDepth: Math.round(avgQuestionLength),
          curiosityIndex: Math.round((followUpQuestions / conversations.length) * 100),
          struggleDetection: Math.round((confusionMarkers / conversations.length) * 100),
          independenceScore: Math.max(0, 100 - Math.round((confusionMarkers / conversations.length) * 100))
        }
      }
    } catch (error: any) {
      // Table might not exist
    }

    // 5. AI Tutor Interaction Trends
    let interactionTrends: any = {}
    try {
      const conversations = await sql`
        SELECT 
          message,
          response,
          created_at,
          topic
        FROM ai_tutor_conversations
        WHERE student_id = ${studentIdNum}
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY created_at ASC
      `
      
      if (conversations.length > 0) {
        const conceptQuestions = conversations.filter((c: any) => {
          const msg = (c.message || "").toLowerCase()
          return /what is|explain|how does|concept|definition/i.test(msg)
        }).length
        
        const debugQuestions = conversations.filter((c: any) => {
          const msg = (c.message || "").toLowerCase()
          return /error|bug|fix|debug|wrong|not working/i.test(msg)
        }).length
        
        // Weekly engagement pattern
        const weeklyPattern: Record<number, number> = {}
        conversations.forEach((c: any) => {
          const dayOfWeek = new Date(c.created_at).getDay()
          weeklyPattern[dayOfWeek] = (weeklyPattern[dayOfWeek] || 0) + 1
        })
        
        interactionTrends = {
          conceptQuestions: conceptQuestions,
          debugQuestions: debugQuestions,
          totalInteractions: conversations.length,
          weeklyPattern: weeklyPattern
        }
      }
    } catch (error: any) {
      // Table might not exist
    }

    // 6. Conversation Timeline
    let conversationTimeline: any[] = []
    try {
      const conversations = await sql`
        SELECT 
          id,
          message,
          topic,
          created_at,
          response_time,
          satisfaction_score
        FROM ai_tutor_conversations
        WHERE student_id = ${studentIdNum}
        ORDER BY created_at DESC
        LIMIT 50
      `
      
      conversationTimeline = conversations.map((c: any) => ({
        id: c.id,
        date: c.created_at,
        topic: c.topic || "General",
        messagePreview: (c.message || "").substring(0, 100),
        responseTime: c.response_time,
        satisfaction: c.satisfaction_score
      }))
    } catch (error: any) {
      // Table might not exist
    }

    // 7. Concept Review Heatmap
    let conceptHeatmap: Record<string, number> = {}
    try {
      const conversations = await sql`
        SELECT topic, COUNT(*) as count
        FROM ai_tutor_conversations
        WHERE student_id = ${studentIdNum}
        AND topic IS NOT NULL
        GROUP BY topic
        ORDER BY count DESC
      `
      
      conversations.forEach((c: any) => {
        conceptHeatmap[c.topic] = parseInt(c.count)
      })
    } catch (error: any) {
      // Table might not exist
    }

    return NextResponse.json({
      conceptMastery: conceptMastery.map((c: any) => ({
        topic: c.topic || "General",
        mastery: parseFloat(c.mastery_percentage) || 0,
        questionsAsked: parseInt(c.questions_asked) || 0,
        accuracy: parseFloat(c.accuracy_percentage) || 0,
        lastPracticed: c.last_practiced
      })),
      reasoningScore,
      reasoningHistory,
      misconceptions,
      behaviorInsights,
      interactionTrends,
      conversationTimeline,
      conceptHeatmap
    })
  } catch (error: any) {
    console.error("[AI Tutor Progress] Error:", error)
    return NextResponse.json({ 
      error: "Failed to fetch progress",
      conceptMastery: [],
      reasoningScore: 0,
      reasoningHistory: [],
      misconceptions: [],
      behaviorInsights: {},
      interactionTrends: {},
      conversationTimeline: [],
      conceptHeatmap: {}
    }, { status: 500 })
  }
}
