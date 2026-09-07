import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

function sourceLabel(source: string | null) {
  if (!source) return ""
  const m: Record<string, string> = {
    practice: "Practice Hub",
    playground: "Playground",
    reading: "Lecture Reading",
    total: "Activity total",
    classroom: "Classroom",
  }
  return m[source] || source
}

export type InstructorTradeLogPayload = {
  transactions: Record<string, unknown>[]
  rollovers: Record<string, unknown>[]
  donationRequests: Record<string, unknown>[]
  pointRequests: Record<string, unknown>[]
}

/**
 * Trade log rows scoped to a course; optional session narrows to roster section codes.
 */
export async function loadInstructorTradeLogPayload(
  courseId: number,
  sessionFilter: string,
  limit = 120,
): Promise<InstructorTradeLogPayload> {
  const narrowSection = sessionFilter !== "" && sessionFilter !== "ALL"
  const cappedLimit = Math.min(300, Math.max(20, limit))

  const sectionVariants = narrowSection ? normalizedSectionVariantsForSql(sessionFilter) : []
  const restrictSectionCodes = narrowSection && sectionVariants.length > 0 ? sectionVariants : null

  const transactions = restrictSectionCodes
    ? await sql`
        SELECT
          tt.id,
          tt.student_id,
          tt.session,
          tt.transaction_type,
          tt.points_used,
          tt.credits_gained,
          tt.recipient_id,
          tt.donation_pool_type,
          tt.created_at,
          donor.full_name as donor_name,
          donor.student_id as donor_number,
          recip.full_name as recipient_name,
          recip.student_id as recipient_number,
          COALESCE(ds.code, donor.section, tt.session) as donor_section
        FROM trade_transactions tt
        LEFT JOIN students donor ON donor.id = tt.student_id
        LEFT JOIN sessions ds ON ds.id = donor.session_id
        LEFT JOIN students recip ON recip.id = tt.recipient_id
        LEFT JOIN sessions rs ON rs.id = recip.session_id
        WHERE (
          (
            ds.course_id = ${courseId}
            AND TRIM(ds.code) = ANY(${restrictSectionCodes}::text[])
          )
          OR (
            tt.recipient_id IS NOT NULL
            AND rs.course_id = ${courseId}
            AND TRIM(rs.code) = ANY(${restrictSectionCodes}::text[])
          )
        )
        ORDER BY tt.created_at DESC NULLS LAST, tt.id DESC
        LIMIT ${cappedLimit}
      `
    : await sql`
        SELECT
          tt.id,
          tt.student_id,
          tt.session,
          tt.transaction_type,
          tt.points_used,
          tt.credits_gained,
          tt.recipient_id,
          tt.donation_pool_type,
          tt.created_at,
          donor.full_name as donor_name,
          donor.student_id as donor_number,
          recip.full_name as recipient_name,
          recip.student_id as recipient_number,
          COALESCE(ds.code, donor.section, tt.session) as donor_section
        FROM trade_transactions tt
        LEFT JOIN students donor ON donor.id = tt.student_id
        LEFT JOIN sessions ds ON ds.id = donor.session_id
        LEFT JOIN students recip ON recip.id = tt.recipient_id
        LEFT JOIN sessions rs ON rs.id = recip.session_id
        WHERE (
          ds.course_id = ${courseId}
          OR (
            tt.recipient_id IS NOT NULL
            AND rs.course_id = ${courseId}
          )
        )
        ORDER BY tt.created_at DESC NULLS LAST, tt.id DESC
        LIMIT ${cappedLimit}
      `

  const txRows = (transactions as Record<string, unknown>[]).map((row) => {
    const ttype = String(row.transaction_type || "")
    const donorLabel =
      (row.donor_name && String(row.donor_name).trim()) ||
      (row.donor_number && String(row.donor_number).trim()) ||
      (row.student_id != null ? `Student #${row.student_id}` : "Unknown student")
    const recipLabel =
      (row.recipient_name && String(row.recipient_name).trim()) ||
      (row.recipient_number && String(row.recipient_number).trim()) ||
      (row.recipient_id != null ? `Student #${row.recipient_id}` : "")
    let summary: string
    if (ttype === "TRADE") {
      summary = `${donorLabel} traded ${row.points_used} pts → ${row.credits_gained ?? 0} EC`
    } else if (ttype === "DONATION") {
      if (String(row.donation_pool_type) === "COMMUNITY") {
        summary = `${donorLabel} donated ${row.points_used} pts to the community pool`
      } else if (row.recipient_id) {
        summary = `${donorLabel} → ${recipLabel || "Peer"}: ${row.points_used} pts`
      } else {
        summary = `${donorLabel}: donation ${row.points_used} pts`
      }
    } else {
      summary = `${ttype || "Activity"} · ${row.points_used} pts`
    }
    return { ...row, summary }
  })

  const rollovers = restrictSectionCodes
    ? await sql`
        SELECT
          grt.id,
          grt.student_id,
          grt.session,
          grt.quiz_id,
          grt.hours,
          grt.points_deducted,
          grt.source_category,
          COALESCE(q.title, 'Assessment') as quiz_title,
          sar.applied_at,
          s.full_name as student_name,
          s.student_id as student_number,
          COALESCE(sess.code, s.section) as section_code
        FROM grade_rollover_trades grt
        JOIN students s ON s.id = grt.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${courseId}
          AND TRIM(sess.code) = ANY(${restrictSectionCodes}::text[])
        LEFT JOIN quizzes q ON q.id = grt.quiz_id
        LEFT JOIN student_assessment_rollovers sar
          ON sar.student_id = grt.student_id AND sar.quiz_id = grt.quiz_id
        ORDER BY sar.applied_at DESC NULLS LAST, grt.id DESC
        LIMIT ${cappedLimit}
      `
    : await sql`
        SELECT
          grt.id,
          grt.student_id,
          grt.session,
          grt.quiz_id,
          grt.hours,
          grt.points_deducted,
          grt.source_category,
          COALESCE(q.title, 'Assessment') as quiz_title,
          sar.applied_at,
          s.full_name as student_name,
          s.student_id as student_number,
          COALESCE(sess.code, s.section) as section_code
        FROM grade_rollover_trades grt
        JOIN students s ON s.id = grt.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${courseId}
        LEFT JOIN quizzes q ON q.id = grt.quiz_id
        LEFT JOIN student_assessment_rollovers sar
          ON sar.student_id = grt.student_id AND sar.quiz_id = grt.quiz_id
        ORDER BY sar.applied_at DESC NULLS LAST, grt.id DESC
        LIMIT ${cappedLimit}
      `

  const rolloverRows = (rollovers as Record<string, unknown>[]).map((r) => ({
    ...r,
    kind: "rollover",
    summary: `${r.student_name}: −${r.points_deducted} from ${r.source_category} → “${r.quiz_title}” (${r.hours}h)`,
  }))

  const donations = restrictSectionCodes
    ? await sql`
        SELECT dr.*,
          d.full_name as donor_name, d.student_id as donor_number,
          r.full_name as recipient_name, r.student_id as recipient_number
        FROM donation_requests dr
        JOIN students d ON dr.donor_id = d.id
        LEFT JOIN sessions sd ON sd.id = d.session_id
        JOIN students r ON dr.recipient_id = r.id
        LEFT JOIN sessions sr ON sr.id = r.session_id
        WHERE (
          (sd.course_id = ${courseId} AND sr.course_id = ${courseId})
          OR EXISTS (
            SELECT 1 FROM sessions sc
            WHERE sc.course_id = ${courseId}
              AND TRIM(sc.code) = TRIM(dr.session)
          )
        )
          AND (
            TRIM(COALESCE(sd.code, d.section, dr.session)) = ANY(${restrictSectionCodes}::text[])
            OR TRIM(COALESCE(sr.code, r.section, dr.session)) = ANY(${restrictSectionCodes}::text[])
            OR TRIM(dr.session) = ANY(${restrictSectionCodes}::text[])
          )
        ORDER BY dr.created_at DESC
        LIMIT ${cappedLimit}
      `
    : await sql`
        SELECT dr.*,
          d.full_name as donor_name, d.student_id as donor_number,
          r.full_name as recipient_name, r.student_id as recipient_number
        FROM donation_requests dr
        JOIN students d ON dr.donor_id = d.id
        LEFT JOIN sessions sd ON sd.id = d.session_id
        JOIN students r ON dr.recipient_id = r.id
        LEFT JOIN sessions sr ON sr.id = r.session_id
        WHERE (sd.course_id = ${courseId} AND sr.course_id = ${courseId})
           OR EXISTS (
             SELECT 1 FROM sessions sc
             WHERE sc.course_id = ${courseId}
               AND TRIM(sc.code) = TRIM(dr.session)
           )
        ORDER BY dr.created_at DESC
        LIMIT ${cappedLimit}
      `

  const donationRows = (donations as Record<string, unknown>[]).map((d) => {
    const sl = sourceLabel(String(d.source || ""))
    return {
      ...d,
      kind: "donation_request",
      source_label: sl,
      summary: `${d.donor_name} → ${d.recipient_name}: ${d.points} pts (${sl}) · ${d.status}`,
    }
  })

  const pointReqs = restrictSectionCodes
    ? await sql`
        SELECT pr.*,
          req.full_name as requester_name, req.student_id as requester_number,
          ree.full_name as requestee_name, ree.student_id as requestee_number
        FROM point_requests pr
        JOIN students req ON pr.requester_id = req.id
        INNER JOIN sessions sreq ON sreq.id = req.session_id AND sreq.course_id = ${courseId}
        JOIN students ree ON pr.requestee_id = ree.id
        INNER JOIN sessions sree ON sree.id = ree.session_id AND sree.course_id = ${courseId}
        WHERE TRIM(sreq.code) = ANY(${restrictSectionCodes}::text[])
          AND TRIM(sree.code) = ANY(${restrictSectionCodes}::text[])
        ORDER BY pr.created_at DESC
        LIMIT ${cappedLimit}
      `
    : await sql`
        SELECT pr.*,
          req.full_name as requester_name, req.student_id as requester_number,
          ree.full_name as requestee_name, ree.student_id as requestee_number
        FROM point_requests pr
        JOIN students req ON pr.requester_id = req.id
        INNER JOIN sessions sreq ON sreq.id = req.session_id AND sreq.course_id = ${courseId}
        JOIN students ree ON pr.requestee_id = ree.id
        INNER JOIN sessions sree ON sree.id = ree.session_id AND sree.course_id = ${courseId}
        ORDER BY pr.created_at DESC
        LIMIT ${cappedLimit}
      `

  const pointRows = (pointReqs as Record<string, unknown>[]).map((p) => ({
    ...p,
    kind: "point_request",
    source_label: sourceLabel(String(p.source || "")),
    summary: `${p.requester_name} requests ${p.points} from ${p.requestee_name} (${sourceLabel(String(p.source || ""))}) · ${p.status}`,
  }))

  return {
    transactions: txRows,
    rollovers: rolloverRows,
    donationRequests: donationRows,
    pointRequests: pointRows,
  }
}

/** Matches instructor Donations UI: pending donations + point requests awaiting instructor. */
export async function loadInstructorDonationsHubPendingPayload(courseId: number): Promise<{
  donationRequests: Record<string, unknown>[]
  pointRequests: Record<string, unknown>[]
}> {
  const donations = await sql`
    SELECT dr.*,
      d.full_name as donor_name, d.student_id as donor_student_id,
      r.full_name as recipient_name, r.student_id as recipient_student_id
    FROM donation_requests dr
    JOIN students d ON dr.donor_id = d.id
    INNER JOIN sessions sd ON sd.id = d.session_id AND sd.course_id = ${courseId}
    JOIN students r ON dr.recipient_id = r.id
    INNER JOIN sessions sr ON sr.id = r.session_id AND sr.course_id = ${courseId}
    WHERE dr.status = 'pending'
    ORDER BY dr.created_at DESC
  `

  const donationRows = (donations as Record<string, unknown>[]).map((d) => ({
    ...d,
    donor_number: d.donor_student_id,
    recipient_number: d.recipient_student_id,
    kind: "donation_request",
    source_label: sourceLabel(String(d.source || "")),
  }))

  const pointReqs = await sql`
    SELECT pr.*,
      req.full_name as requester_name, req.student_id as requester_student_id,
      ree.full_name as requestee_name, ree.student_id as requestee_student_id
    FROM point_requests pr
    JOIN students req ON pr.requester_id = req.id
    INNER JOIN sessions sreq ON sreq.id = req.session_id AND sreq.course_id = ${courseId}
    JOIN students ree ON pr.requestee_id = ree.id
    INNER JOIN sessions sree ON sree.id = ree.session_id AND sree.course_id = ${courseId}
    WHERE pr.status = 'pending_instructor'
    ORDER BY pr.created_at DESC
  `

  const pointRows = (pointReqs as Record<string, unknown>[]).map((p) => ({
    ...p,
    requester_number: p.requester_student_id,
    requestee_number: p.requestee_student_id,
    kind: "point_request",
    source_label: sourceLabel(String(p.source || "")),
  }))

  return {
    donationRequests: donationRows,
    pointRequests: pointRows,
  }
}
