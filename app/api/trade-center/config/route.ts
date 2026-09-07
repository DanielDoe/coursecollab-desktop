import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logTradeCenterRulesChange } from "@/lib/course-assessment-audit";
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema";
import {
  DEFAULT_TRADE_CENTER_CONFIG,
  parseTradeCenterConfigRow,
  validateTradeCenterConfigInput,
} from "@/lib/trade-center-shared";
import { requireTradeCenterConfigRead } from "@/lib/trade-center-request-auth";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTradeCenterConfigRead(request);
    if (!auth.ok) return auth.response;

    await ensureTradeCenterConfigSchema();
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session") || "ALL";

    const config = await sql`
      SELECT * FROM trade_center_config
      WHERE session = ${session} OR session = 'ALL'
      ORDER BY CASE WHEN session = ${session} THEN 0 ELSE 1 END
      LIMIT 1
    `;

    if (config.length === 0) {
      return NextResponse.json({ config: { ...DEFAULT_TRADE_CENTER_CONFIG, session } });
    }

    return NextResponse.json({ config: parseTradeCenterConfigRow(config[0] as Record<string, unknown>) });
  } catch (error) {
    console.error("Error fetching trade center config:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade center configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request);
    if (!scope.ok) return scope.response;
    const inst = scope.instructorId;

    const body = (await request.json()) as Record<string, unknown>;
    const validated = validateTradeCenterConfigInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    await ensureTradeCenterConfigSchema();

    const existing = await sql`
      SELECT * FROM trade_center_config WHERE session = ${validated.config.session} LIMIT 1
    `;
    const oldConfig = existing[0] ?? null;
    const c = oldConfig
      ? { ...parseTradeCenterConfigRow(oldConfig as Record<string, unknown>), ...validated.config }
      : validated.config;

    await sql`
      INSERT INTO trade_center_config (
        session,
        practice_weight, playground_weight, reading_weight,
        weekly_practice_cap, weekly_playground_cap, weekly_reading_cap,
        ec_conversion_multiplier, max_engagement_credits,
        trading_enabled, donations_enabled, min_donation_points, weekly_reset_day,
        is_active, practice_enabled, playground_enabled, reading_enabled
      )
      VALUES (
        ${c.session},
        ${c.practice_weight}, ${c.playground_weight}, ${c.reading_weight},
        ${c.weekly_practice_cap}, ${c.weekly_playground_cap}, ${c.weekly_reading_cap},
        ${c.ec_conversion_multiplier}, ${c.max_engagement_credits},
        ${c.trading_enabled}, ${c.donations_enabled}, ${c.min_donation_points}, ${c.weekly_reset_day},
        ${c.is_active}, ${c.practice_enabled}, ${c.playground_enabled}, ${c.reading_enabled}
      )
      ON CONFLICT (session)
      DO UPDATE SET
        practice_weight = EXCLUDED.practice_weight,
        playground_weight = EXCLUDED.playground_weight,
        reading_weight = EXCLUDED.reading_weight,
        weekly_practice_cap = EXCLUDED.weekly_practice_cap,
        weekly_playground_cap = EXCLUDED.weekly_playground_cap,
        weekly_reading_cap = EXCLUDED.weekly_reading_cap,
        ec_conversion_multiplier = EXCLUDED.ec_conversion_multiplier,
        max_engagement_credits = EXCLUDED.max_engagement_credits,
        trading_enabled = EXCLUDED.trading_enabled,
        donations_enabled = EXCLUDED.donations_enabled,
        min_donation_points = EXCLUDED.min_donation_points,
        weekly_reset_day = EXCLUDED.weekly_reset_day,
        is_active = EXCLUDED.is_active,
        practice_enabled = EXCLUDED.practice_enabled,
        playground_enabled = EXCLUDED.playground_enabled,
        reading_enabled = EXCLUDED.reading_enabled,
        updated_at = CURRENT_TIMESTAMP
    `;

    const updated = await sql`
      SELECT * FROM trade_center_config WHERE session = ${c.session}
    `;

    const courseId = Number(body.courseId ?? request.headers.get("x-course-id"));
    await logTradeCenterRulesChange({
      actorId: inst,
      courseId: Number.isFinite(courseId) && courseId > 0 ? courseId : null,
      session: c.session,
      oldValue: oldConfig,
      newValue: updated[0],
    });

    return NextResponse.json({
      success: true,
      config: parseTradeCenterConfigRow(updated[0] as Record<string, unknown>),
      message: "Trade center configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating trade center config:", error);
    return NextResponse.json(
      { error: "Failed to update trade center configuration" },
      { status: 500 }
    );
  }
}
