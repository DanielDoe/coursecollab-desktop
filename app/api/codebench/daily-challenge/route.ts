import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

export async function POST(request: NextRequest) {
  try {
    let body: { code?: unknown; studentId?: unknown; learningMode?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const claimed = body.studentId != null ? String(body.studentId) : null
    const bound = await requireCodebenchStudent(request, claimed)
    if (!bound.ok) return bound.response

    const code = typeof body.code === "string" ? body.code : ""
    const learningMode =
      body.learningMode === "beginner" || body.learningMode === "expert"
        ? body.learningMode
        : "intermediate"

    const today = new Date().toISOString().split("T")[0]
    const studentIdNum = bound.studentDbId

    // Check if student already has a challenge for today
    // First, ensure the table exists
    await sql`
      CREATE TABLE IF NOT EXISTS daily_challenge_submissions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        challenge_id VARCHAR(100) NOT NULL,
        challenge_title TEXT NOT NULL,
        challenge_description TEXT NOT NULL,
        score DECIMAL(3,1),
        points_awarded DECIMAL(5,2),
        feedback TEXT,
        detailed_feedback TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        practice_point_id INTEGER,
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Check if student already received a challenge today (even if not submitted)
    const existingChallenge = await sql`
      SELECT challenge_id, challenge_title, challenge_description
      FROM daily_challenge_submissions
      WHERE student_id = ${studentIdNum}
        AND DATE(submitted_at) = ${today}
      ORDER BY submitted_at DESC
      LIMIT 1
    `

    // If student already has a challenge for today, return it
    if (existingChallenge.length > 0) {
      const challenge = existingChallenge[0]
      return NextResponse.json({
        id: challenge.challenge_id,
        title: challenge.challenge_title,
        description: challenge.challenge_description,
        difficulty: "Medium", // Default, could be stored if needed
        xpReward: 10,
        completed: false,
        date: today,
      })
    }

    // Check if we need to create a table to track challenges that were generated but not yet submitted
    await sql`
      CREATE TABLE IF NOT EXISTS daily_challenge_assignments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        challenge_id VARCHAR(100) NOT NULL,
        challenge_title TEXT NOT NULL,
        challenge_description TEXT NOT NULL,
        challenge_difficulty VARCHAR(20) DEFAULT 'Medium',
        challenge_xp_reward INTEGER DEFAULT 10,
        assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, assigned_date)
      )
    `

    // Check if student has an assigned challenge for today
    const assignedChallenge = await sql`
      SELECT challenge_id, challenge_title, challenge_description, challenge_difficulty, challenge_xp_reward
      FROM daily_challenge_assignments
      WHERE student_id = ${studentIdNum}
        AND assigned_date = ${today}
      LIMIT 1
    `

    // If student already has an assigned challenge for today, return it
    if (assignedChallenge.length > 0) {
      const challenge = assignedChallenge[0]
      return NextResponse.json({
        id: challenge.challenge_id,
        title: challenge.challenge_title,
        description: challenge.challenge_description,
        difficulty: challenge.challenge_difficulty || "Medium",
        xpReward: challenge.challenge_xp_reward || 10,
        completed: false,
        date: today,
      })
    }

    // Generate challenge using AI
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      // Return default challenge if API not available and store it
      const challengeId = `challenge_${today}_${studentIdNum}_${Date.now()}`
      const defaultTitle = "Practice Problem Solving"
      const defaultDescription = code
        ? "Review your current code and identify one improvement you can make. Implement it and explain why it's better."
        : "Write a simple C++ program that demonstrates your understanding of loops and conditionals."

      await sql`
        INSERT INTO daily_challenge_assignments (
          student_id, challenge_id, challenge_title, challenge_description, 
          challenge_difficulty, challenge_xp_reward, assigned_date
        )
        VALUES (
          ${studentIdNum}, 
          ${challengeId}, 
          ${defaultTitle}, 
          ${defaultDescription},
          'Medium',
          10,
          ${today}
        )
        ON CONFLICT (student_id, assigned_date) DO UPDATE SET
          challenge_id = EXCLUDED.challenge_id,
          challenge_title = EXCLUDED.challenge_title,
          challenge_description = EXCLUDED.challenge_description
      `

      return NextResponse.json({
        id: challengeId,
        title: defaultTitle,
        description: defaultDescription,
        difficulty: "Medium",
        xpReward: 10,
        completed: false,
        date: today,
      })
    }

    const difficultyGuidance = learningMode === "beginner"
      ? `For BEGINNER level students:
- Create simple, straightforward challenges
- Focus on basic concepts (variables, simple loops, conditionals)
- Use "Easy" difficulty level
- Make challenges achievable and confidence-building
- Provide clear examples`
      : learningMode === "expert"
      ? `For EXPERT level students:
- Create challenging problems requiring advanced techniques
- Focus on optimization, edge cases, and design patterns
- Use "Hard" difficulty level
- Test deep understanding and problem-solving skills
- Include complex algorithms`
      : `For INTERMEDIATE level students:
- Create problems that build on fundamentals
- Focus on algorithmic thinking and logic flow
- Use "Medium" difficulty level
- Balance challenge with achievability
- Test understanding of concepts`

    const challengePrompt = code
      ? `Based on this C++ code, create a small daily challenge for a ${learningMode} level student that helps improve coding skills:

\`\`\`cpp
${code}
\`\`\`

${difficultyGuidance}

Return a JSON object with:
{
  "title": "Challenge title (short, specific)",
  "description": "Markdown problem statement with sections: ## Problem, ## Input, ## Output, ## Constraints, ## Example (with sample I/O in fenced code blocks). No solution code.",
  "difficulty": "Easy" | "Medium" | "Hard",
  "xpReward": <number between 5-20>
}

Make it educational and achievable in 15-30 minutes. Do NOT provide the solution code.`

      : `Create a small daily C++ coding challenge suitable for a ${learningMode} level student.

${difficultyGuidance}

Return a JSON object with:
{
  "title": "Challenge title (short, specific)",
  "description": "Markdown problem statement with sections: ## Problem, ## Input, ## Output, ## Constraints, ## Example (with sample I/O in fenced code blocks). No solution code.",
  "difficulty": "Easy" | "Medium" | "Hard",
  "xpReward": <number between 5-20>
}

Make it educational and achievable in 15-30 minutes. Do NOT provide the solution code.`

    let challengeData: { title?: string; description?: string; difficulty?: string; xpReward?: number }
    try {
      const openai = new OpenAI({ apiKey: openaiApiKey })
      const { content } = await createForFeature(openai, "codebench", {

        messages: [
          {
            role: "system",
            content:
              "You are an expert programming tutor. Create engaging daily coding challenges that help students learn. Always return valid JSON. The description MUST be markdown with ## Problem, ## Input, ## Output, ## Constraints, and ## Example. Never provide full code solutions.",
          },
          { role: "user", content: challengePrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      })
      challengeData = JSON.parse(content || "{}")
    } catch (fetchError) {
      // Check if we already have a stored challenge for today
      const storedChallenge = await sql`
        SELECT challenge_id, challenge_title, challenge_description, challenge_difficulty, challenge_xp_reward
        FROM daily_challenge_assignments
        WHERE student_id = ${studentIdNum}
          AND assigned_date = ${today}
        LIMIT 1
      `

      if (storedChallenge.length > 0) {
        const challenge = storedChallenge[0]
        return NextResponse.json({
          id: challenge.challenge_id,
          title: challenge.challenge_title,
          description: challenge.challenge_description,
          difficulty: challenge.challenge_difficulty || "Medium",
          xpReward: challenge.challenge_xp_reward || 10,
          completed: false,
          date: today,
        })
      }

      // Return default challenge and store it
      const challengeId = `challenge_${today}_${studentIdNum}_${Date.now()}`
      const defaultTitle = "Practice Problem Solving"
      const defaultDescription = "Write a C++ program that demonstrates good coding practices."

      await sql`
        INSERT INTO daily_challenge_assignments (
          student_id, challenge_id, challenge_title, challenge_description, 
          challenge_difficulty, challenge_xp_reward, assigned_date
        )
        VALUES (
          ${studentIdNum}, 
          ${challengeId}, 
          ${defaultTitle}, 
          ${defaultDescription},
          'Medium',
          10,
          ${today}
        )
        ON CONFLICT (student_id, assigned_date) DO UPDATE SET
          challenge_id = EXCLUDED.challenge_id,
          challenge_title = EXCLUDED.challenge_title,
          challenge_description = EXCLUDED.challenge_description
      `

      return NextResponse.json({
        id: challengeId,
        title: defaultTitle,
        description: defaultDescription,
        difficulty: "Medium",
        xpReward: 10,
        completed: false,
        date: today,
      })
    }

    const challenge = challengeData
    try {
      const challengeId = `challenge_${today}_${studentIdNum}_${Date.now()}`
      const challengeTitle = challenge.title || "Daily Challenge"
      const challengeDescription = challenge.description || "Complete your daily coding challenge"
      const challengeDifficulty = challenge.difficulty || "Medium"
      const challengeXpReward = challenge.xpReward || 10

      // Store the assigned challenge so we can return the same one if requested again
      await sql`
        INSERT INTO daily_challenge_assignments (
          student_id, challenge_id, challenge_title, challenge_description, 
          challenge_difficulty, challenge_xp_reward, assigned_date
        )
        VALUES (
          ${studentIdNum}, 
          ${challengeId}, 
          ${challengeTitle}, 
          ${challengeDescription},
          ${challengeDifficulty},
          ${challengeXpReward},
          ${today}
        )
        ON CONFLICT (student_id, assigned_date) DO UPDATE SET
          challenge_id = EXCLUDED.challenge_id,
          challenge_title = EXCLUDED.challenge_title,
          challenge_description = EXCLUDED.challenge_description,
          challenge_difficulty = EXCLUDED.challenge_difficulty,
          challenge_xp_reward = EXCLUDED.challenge_xp_reward
      `

      return NextResponse.json({
        id: challengeId,
        title: challengeTitle,
        description: challengeDescription,
        difficulty: challengeDifficulty,
        xpReward: challengeXpReward,
        completed: false,
        date: today,
      })
    } catch (parseError) {
      console.error("Failed to parse challenge:", parseError)
      
      // Check if we already have a stored challenge for today
      const storedChallenge = await sql`
        SELECT challenge_id, challenge_title, challenge_description, challenge_difficulty, challenge_xp_reward
        FROM daily_challenge_assignments
        WHERE student_id = ${studentIdNum}
          AND assigned_date = ${today}
        LIMIT 1
      `

      if (storedChallenge.length > 0) {
        const challenge = storedChallenge[0]
        return NextResponse.json({
          id: challenge.challenge_id,
          title: challenge.challenge_title,
          description: challenge.challenge_description,
          difficulty: challenge.challenge_difficulty || "Medium",
          xpReward: challenge.challenge_xp_reward || 10,
          completed: false,
          date: today,
        })
      }

      // Return default challenge and store it
      const challengeId = `challenge_${today}_${studentIdNum}_${Date.now()}`
      const defaultTitle = "Practice Problem Solving"
      const defaultDescription = "Write a C++ program that demonstrates good coding practices."

      await sql`
        INSERT INTO daily_challenge_assignments (
          student_id, challenge_id, challenge_title, challenge_description, 
          challenge_difficulty, challenge_xp_reward, assigned_date
        )
        VALUES (
          ${studentIdNum}, 
          ${challengeId}, 
          ${defaultTitle}, 
          ${defaultDescription},
          'Medium',
          10,
          ${today}
        )
        ON CONFLICT (student_id, assigned_date) DO UPDATE SET
          challenge_id = EXCLUDED.challenge_id,
          challenge_title = EXCLUDED.challenge_title,
          challenge_description = EXCLUDED.challenge_description
      `

      return NextResponse.json({
        id: challengeId,
        title: defaultTitle,
        description: defaultDescription,
        difficulty: "Medium",
        xpReward: 10,
        completed: false,
        date: today,
      })
    }
  } catch (error) {
    console.error("Daily challenge error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

