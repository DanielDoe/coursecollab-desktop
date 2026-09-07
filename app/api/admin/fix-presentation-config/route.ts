import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth";
import { sql } from "@/lib/db";

/**
 * POST /api/admin/fix-presentation-config
 * Fix presentation configuration dates for all sessions
 * Ensures all sessions have correct dates: Nov 17-25, 2025
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Expected correct configuration
    const correctConfigs = [
      {
        session: 'ELEG1301P01',
        presentation_start_date: '2025-11-17',
        presentation_end_date: '2025-11-25',
        lecture_days: ['Monday', 'Wednesday'],
        start_time: '09:00:00',
        end_time: '10:20:00',
        slot_duration: 20,
        location: 'New Electrical Engineering Bldg 119'
      },
      {
        session: 'ELEG1304P01',
        presentation_start_date: '2025-11-17',
        presentation_end_date: '2025-11-25',
        lecture_days: ['Tuesday', 'Thursday'],
        start_time: '09:00:00',
        end_time: '10:20:00',
        slot_duration: 20,
        location: 'New Electrical Engineering Bldg 119'
      },
      {
        session: 'P05',
        presentation_start_date: '2025-11-17',
        presentation_end_date: '2025-11-25',
        lecture_days: ['Tuesday', 'Thursday'],
        start_time: '11:00:00',
        end_time: '12:20:00',
        slot_duration: 20,
        location: 'New Electrical Engineering Bldg 119'
      }
    ];

    const results = [];

    // Update each session
    for (const config of correctConfigs) {
      const result = await sql`
        INSERT INTO presentation_config (
          session,
          presentation_start_date,
          presentation_end_date,
          lecture_days,
          start_time,
          end_time,
          slot_duration,
          location,
          is_active
        ) VALUES (
          ${config.session},
          ${config.presentation_start_date},
          ${config.presentation_end_date},
          ${config.lecture_days},
          ${config.start_time},
          ${config.end_time},
          ${config.slot_duration},
          ${config.location},
          TRUE
        )
        ON CONFLICT (session) DO UPDATE SET
          presentation_start_date = EXCLUDED.presentation_start_date,
          presentation_end_date = EXCLUDED.presentation_end_date,
          lecture_days = EXCLUDED.lecture_days,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          slot_duration = EXCLUDED.slot_duration,
          location = EXCLUDED.location,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      results.push({
        session: config.session,
        updated: true,
        config: result[0]
      });
    }

    // Verify final state
    const finalConfigs = await sql`
      SELECT 
        session,
        presentation_start_date,
        presentation_end_date,
        lecture_days,
        start_time,
        end_time,
        slot_duration,
        location,
        is_active
      FROM presentation_config
      WHERE is_active = TRUE
      ORDER BY session
    `;

    return NextResponse.json({
      success: true,
      message: "Presentation configurations fixed successfully",
      updated: results,
      finalConfigs: finalConfigs
    });

  } catch (error) {
    console.error("Error fixing presentation config:", error);
    return NextResponse.json(
      { error: "Failed to fix presentation configuration" },
      { status: 500 }
    );
  }
}

