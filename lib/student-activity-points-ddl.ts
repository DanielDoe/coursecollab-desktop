/** Inline DDL for dev/bootstrap when student_activity_points is missing. Keep in sync with migrations. */

export const STUDENT_ACTIVITY_POINTS_SESSION_CHECK =
  "session IN ('ELEG1301P01', 'ELEG1304P01', 'P01', 'P02', 'P05', 'BETA', 'ALL')"

export function getCreateStudentActivityPointsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS student_activity_points (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session VARCHAR(64) NOT NULL CHECK (${STUDENT_ACTIVITY_POINTS_SESSION_CHECK}),
  practice_points INTEGER DEFAULT 0 CHECK (practice_points >= 0),
  playground_points INTEGER DEFAULT 0 CHECK (playground_points >= 0),
  reading_points INTEGER DEFAULT 0 CHECK (reading_points >= 0),
  total_points INTEGER GENERATED ALWAYS AS (
    practice_points + playground_points + reading_points
  ) STORED,
  engagement_credits INTEGER DEFAULT 0 CHECK (engagement_credits >= 0 AND engagement_credits <= 10),
  week_start_date DATE DEFAULT CURRENT_DATE,
  last_trade_at TIMESTAMP,
  total_trades_count INTEGER DEFAULT 0,
  total_donations_count INTEGER DEFAULT 0,
  total_donated_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, session, week_start_date)
)`
}
