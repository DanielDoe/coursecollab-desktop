import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  }

  try {
    // Test 1: Check if tables exist
    console.log("🧪 Test 1: Checking if required tables exist...")
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('practice_attempts', 'practice_answers', 'students', 'question_bank', 'topic_availability')
      ORDER BY table_name
    `
    testResults.tests.push({
      test: "Tables Exist",
      status: tables.length === 5 ? "PASS" : "FAIL",
      expected: 5,
      actual: tables.length,
      tables: tables.map(t => t.table_name)
    })

    // Test 2: Check question bank topics
    console.log("🧪 Test 2: Checking question bank topics...")
    const topics = await sql`
      SELECT 
        topic,
        COUNT(*) as question_count
      FROM question_bank 
      WHERE topic IS NOT NULL AND topic != ''
      GROUP BY topic
      ORDER BY topic
    `
    testResults.tests.push({
      test: "Question Bank Topics",
      status: topics.length > 0 ? "PASS" : "FAIL",
      topicsFound: topics.length,
      topics: topics.map(t => ({ name: t.topic, count: Number(t.question_count) }))
    })

    // Test 3: Check topic availability
    console.log("🧪 Test 3: Checking topic availability...")
    const availability = await sql`
      SELECT 
        topic,
        session,
        is_available,
        daily_limit
      FROM topic_availability
      ORDER BY topic, session
    `
    testResults.tests.push({
      test: "Topic Availability",
      status: "INFO",
      recordsFound: availability.length,
      availability: availability.slice(0, 10) // First 10 for brevity
    })

    // Test 4: Check students
    console.log("🧪 Test 4: Checking students...")
    const students = await sql`
      SELECT COUNT(*) as count FROM students
    `
    testResults.tests.push({
      test: "Students Count",
      status: Number(students[0].count) > 0 ? "PASS" : "WARN",
      studentsFound: Number(students[0].count)
    })

    // Test 5: Check practice attempts
    console.log("🧪 Test 5: Checking practice attempts...")
    const attempts = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT student_id) as students_with_attempts,
        AVG(score_percentage) as avg_score
      FROM practice_attempts
      WHERE completed_at IS NOT NULL
    `
    testResults.tests.push({
      test: "Practice Attempts",
      status: Number(attempts[0].total_attempts) > 0 ? "PASS" : "WARN",
      totalAttempts: Number(attempts[0].total_attempts),
      studentsWithAttempts: Number(attempts[0].students_with_attempts),
      avgScore: attempts[0].avg_score ? Number(attempts[0].avg_score).toFixed(2) : 0
    })

    // Test 6: Simulate fetching topics for ALL session
    console.log("🧪 Test 6: Testing topics API for ALL session...")
    const allSessionTopics = await sql`
      SELECT 
        qb.topic,
        COUNT(qb.id) as question_count,
        ta.is_available,
        ta.daily_limit
      FROM question_bank qb
      LEFT JOIN topic_availability ta ON qb.topic = ta.topic AND ta.session = 'ALL'
      WHERE qb.topic IS NOT NULL AND qb.topic != ''
      GROUP BY qb.topic, ta.is_available, ta.daily_limit
      ORDER BY qb.topic
    `
    testResults.tests.push({
      test: "Topics API Simulation (ALL)",
      status: allSessionTopics.length > 0 ? "PASS" : "FAIL",
      topicsFound: allSessionTopics.length,
      sampleTopics: allSessionTopics.slice(0, 5)
    })

    // Test 7: Simulate student progress query
    console.log("🧪 Test 7: Testing student progress query...")
    const studentProgress = await sql`
      SELECT 
        s.id as student_id,
        s.full_name as student_name,
        s.section as student_section,
        COUNT(pa.id) as total_attempts,
        COALESCE(AVG(CAST(pa.score_percentage AS NUMERIC)), 0) as avg_score
      FROM students s
      INNER JOIN practice_attempts pa ON s.id = pa.student_id
      WHERE pa.completed_at IS NOT NULL
      GROUP BY s.id, s.full_name, s.section
      HAVING COUNT(pa.id) > 0
      ORDER BY s.full_name
      LIMIT 5
    `
    testResults.tests.push({
      test: "Student Progress Query",
      status: studentProgress.length > 0 ? "PASS" : "WARN",
      studentsFound: studentProgress.length,
      students: studentProgress.map(s => ({
        id: Number(s.student_id),
        name: s.student_name,
        section: s.student_section,
        attempts: Number(s.total_attempts),
        avgScore: Number(s.avg_score).toFixed(2)
      }))
    })

    // Summary
    const passCount = testResults.tests.filter(t => t.status === "PASS").length
    const failCount = testResults.tests.filter(t => t.status === "FAIL").length
    const warnCount = testResults.tests.filter(t => t.status === "WARN").length

    testResults.summary = {
      total: testResults.tests.length,
      passed: passCount,
      failed: failCount,
      warnings: warnCount,
      status: failCount === 0 ? "ALL_TESTS_PASSED" : "SOME_TESTS_FAILED"
    }

    console.log("✅ All tests completed!")
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`)

    return NextResponse.json(testResults)
  } catch (error) {
    console.error("❌ Test suite error:", error)
    return NextResponse.json({ 
      error: "Test suite failed", 
      details: error.message,
      testResults 
    }, { status: 500 })
  }
}
