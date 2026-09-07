import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashFacultyPassword } from "@/lib/faculty-password"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    // Create instructors table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS instructors (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `

    // Create instructor_module_preferences table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS instructor_module_preferences (
        id SERIAL PRIMARY KEY,
        instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE,
        module_name VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        settings JSONB DEFAULT '{}',
        last_accessed TIMESTAMP DEFAULT NOW(),
        UNIQUE(instructor_id, module_name)
      )
    `

    // Create practice_configs table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS practice_configs (
        id SERIAL PRIMARY KEY,
        instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE,
        daily_limit INTEGER DEFAULT 10,
        difficulty_distribution JSONB DEFAULT '{"easy": 0.3, "medium": 0.5, "hard": 0.2}',
        topic_weights JSONB DEFAULT '{}',
        leaderboard_reset_schedule VARCHAR(50) DEFAULT 'weekly',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create password_reset_requests table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        approved_by INTEGER REFERENCES instructors(id),
        approved_at TIMESTAMP
      )
    `

    const setupPasswordHash = await hashFacultyPassword("dmdoe123")
    // Insert instructor user
    const instructor = await sql`
      INSERT INTO instructors (
        id,
        username,
        email,
        name,
        password,
        created_at
      ) VALUES (
        1,
        'dmdoe',
        'dmdoe@pvamu.edu',
        'Daniel Doe',
        ${setupPasswordHash},
        NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        password = EXCLUDED.password
      RETURNING *
    `

    await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS institution VARCHAR(255)`
    await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS job_title VARCHAR(128)`
    await sql`
      UPDATE instructors SET
        institution = 'Prairie View A&M University',
        job_title = 'Assistant Professor',
        is_active = true,
        has_changed_password = true,
        role = 'instructor'
      WHERE username = 'dmdoe'
    `

    return NextResponse.json({ 
      message: "Instructor user created successfully",
      instructor: instructor[0],
      credentials: {
        username: "dmdoe",
        password: "dmdoe123"
      }
    })
  } catch (error) {
    console.error("Error creating instructor user:", error)
    return NextResponse.json({ error: "Failed to create instructor user" }, { status: 500 })
  }
}

