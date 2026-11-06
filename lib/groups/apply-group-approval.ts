import { sql } from "@/lib/db"

type PendingChanges = {
  name?: string
  addMembers?: number[]
  removeMembers?: number[]
}

/** Apply pending membership/name changes and mark the group approved. */
export async function applyGroupApproval(
  groupId: number,
  pendingChanges: PendingChanges | null | undefined,
): Promise<void> {
  if (pendingChanges) {
    if (pendingChanges.name) {
      await sql`
        UPDATE groups
        SET name = ${pendingChanges.name}
        WHERE id = ${groupId}
      `
    }

    if (Array.isArray(pendingChanges.addMembers)) {
      for (const studentId of pendingChanges.addMembers) {
        const existingMembership = await sql`
          SELECT gm.id
          FROM group_members gm
          JOIN groups g ON gm.group_id = g.id
          WHERE gm.student_id = ${studentId}
        `
        if (existingMembership.length > 0) {
          await sql`DELETE FROM group_members WHERE student_id = ${studentId}`
        }
        await sql`
          INSERT INTO group_members (group_id, student_id)
          VALUES (${groupId}, ${studentId})
          ON CONFLICT (group_id, student_id) DO NOTHING
        `
      }
    }

    if (Array.isArray(pendingChanges.removeMembers)) {
      for (const studentId of pendingChanges.removeMembers) {
        await sql`
          DELETE FROM group_members
          WHERE group_id = ${groupId} AND student_id = ${studentId}
        `
      }
    }
  }

  await sql`
    UPDATE groups
    SET status = 'approved', pending_changes = NULL
    WHERE id = ${groupId}
  `
}
