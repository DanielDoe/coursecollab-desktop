import { sql } from "@/lib/db"

let ensured = false

/** Persist section-level countdown state on quiz_attempts (jsonb keyed by section index). */
export async function ensureSectionTimerSchema(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS section_time_remaining JSONB
  `
  // A paused attempt (save-and-finish-later, deadline cleared) must not lose section time
  // if the quiz screen stays open and keeps posting a countdown.
  await sql`
    CREATE OR REPLACE FUNCTION quiz_attempts_preserve_paused_section_timer()
    RETURNS TRIGGER AS $$
    DECLARE
      old_key text;
      old_val numeric;
      new_val numeric;
      merged jsonb;
    BEGIN
      IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
      END IF;
      IF OLD.saved_for_later_at IS NULL OR OLD.deadline_at IS NOT NULL THEN
        RETURN NEW;
      END IF;
      IF NEW.completed_at IS NOT NULL OR OLD.section_time_remaining IS NULL THEN
        RETURN NEW;
      END IF;
      IF NEW.section_time_remaining IS NULL THEN
        NEW.section_time_remaining := OLD.section_time_remaining;
        RETURN NEW;
      END IF;

      merged := NEW.section_time_remaining;
      FOR old_key, old_val IN
        SELECT key, value::numeric
        FROM jsonb_each_text(OLD.section_time_remaining)
      LOOP
        new_val := NULL;
        IF merged ? old_key THEN
          BEGIN
            new_val := (merged ->> old_key)::numeric;
          EXCEPTION WHEN others THEN
            new_val := NULL;
          END;
        END IF;
        IF new_val IS NULL OR new_val < old_val THEN
          merged := jsonb_set(merged, ARRAY[old_key], to_jsonb(old_val), true);
        END IF;
      END LOOP;
      NEW.section_time_remaining := merged;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `
  await sql`
    DROP TRIGGER IF EXISTS quiz_attempts_preserve_paused_section_timer ON quiz_attempts
  `
  await sql`
    CREATE TRIGGER quiz_attempts_preserve_paused_section_timer
      BEFORE UPDATE ON quiz_attempts
      FOR EACH ROW
      EXECUTE FUNCTION quiz_attempts_preserve_paused_section_timer()
  `
  ensured = true
}
