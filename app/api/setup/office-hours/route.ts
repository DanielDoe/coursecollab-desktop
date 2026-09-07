import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureOfficeHoursCourseScopeColumns } from "@/lib/office-hours-course-scope"
import { ensureOfficeHoursPublicProfileSchema } from "@/lib/office-hours-public-profile"

export const dynamic = "force-dynamic"

export async function POST(_request: NextRequest) {
  try {
    // Drop orphaned sequences if tables don't exist (from partial previous create)
    const reqExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'office_hour_requests'
      LIMIT 1
    `
    if (reqExists.length === 0) {
      await sql`DROP SEQUENCE IF EXISTS office_hour_requests_id_seq CASCADE`
    }

    const attExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'office_hour_attachments'
      LIMIT 1
    `
    if (attExists.length === 0) {
      await sql`DROP SEQUENCE IF EXISTS office_hour_attachments_id_seq CASCADE`
    }

    const prefExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'office_hour_preferred_dates'
      LIMIT 1
    `
    if (prefExists.length === 0) {
      await sql`DROP SEQUENCE IF EXISTS office_hour_preferred_dates_id_seq CASCADE`
    }

    const regExists = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'regular_office_hours'
      LIMIT 1
    `
    if (regExists.length === 0) {
      await sql`DROP SEQUENCE IF EXISTS regular_office_hours_id_seq CASCADE`
    }

    await sql`
      CREATE TABLE IF NOT EXISTS office_hour_requests (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
        topic VARCHAR(255) NOT NULL,
        area_of_concern VARCHAR(255),
        description TEXT,
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        requested_date TIMESTAMP,
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'scheduled', 'rejected', 'completed', 'cancelled')),
        scheduled_date TIMESTAMP,
        meeting_link TEXT,
        meeting_venue TEXT,
        instructor_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_office_hour_requests_student ON office_hour_requests(student_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_office_hour_requests_instructor ON office_hour_requests(instructor_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_office_hour_requests_status ON office_hour_requests(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_office_hour_requests_created ON office_hour_requests(created_at DESC)`

    await sql`
      CREATE TABLE IF NOT EXISTS office_hour_attachments (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES office_hour_requests(id) ON DELETE CASCADE,
        file_name VARCHAR(255),
        file_type VARCHAR(50),
        file_url TEXT,
        content TEXT,
        content_type VARCHAR(20) CHECK (content_type IN ('file', 'code')),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_office_hour_attachments_request ON office_hour_attachments(request_id)`

    await sql`
      CREATE TABLE IF NOT EXISTS office_hour_preferred_dates (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES office_hour_requests(id) ON DELETE CASCADE,
        preferred_date TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_office_hour_preferred_dates_request ON office_hour_preferred_dates(request_id)`

    await sql`
      CREATE TABLE IF NOT EXISTS regular_office_hours (
        id SERIAL PRIMARY KEY,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        semester_label VARCHAR(50) DEFAULT 'current',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_regular_office_hours_day ON regular_office_hours(day_of_week)`

    await ensureOfficeHoursCourseScopeColumns()
    await ensureOfficeHoursPublicProfileSchema()

    return NextResponse.json({
      success: true,
      message: "Office hours tables initialized successfully",
    })
  } catch (error) {
    console.error("[Setup Office Hours]:", error)
    return NextResponse.json({ error: "Failed to setup office hours tables" }, { status: 500 })
  }
}
