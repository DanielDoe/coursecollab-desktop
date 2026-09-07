import { sql } from "@/lib/db"

interface CreateAdminNotificationParams {
  type: string
  title: string
  message: string
  link?: string
  adminId?: number
}

export async function createAdminNotification({ type, title, message, link, adminId }: CreateAdminNotificationParams) {
  try {
    if (adminId) {
      // Notify specific admin
      await sql`
        INSERT INTO admin_notifications (admin_id, type, title, message, link, created_at)
        VALUES (${adminId}, ${type}, ${title}, ${message}, ${link || null}, NOW())
      `
      console.log("[v0] Admin notification created:", { adminId, type, title })
    } else {
      console.log("[v0] 📊 Creating admin notifications for all admins")

      const result = await sql`
        INSERT INTO admin_notifications (admin_id, type, title, message, link, created_at)
        SELECT id, ${type}, ${title}, ${message}, ${link || null}, NOW()
        FROM admin_users
        RETURNING id
      `

      console.log(`[v0] ✅ Notified ${result.length} admins with single query:`, { type, title })
    }
  } catch (error: any) {
    // Silently fail if table doesn't exist
    if (error.code === "42P01") {
      console.log("[v0] Admin notifications table not created yet")
      return
    }
    console.error("[v0] Failed to create admin notification:", error)
  }
}

// Helper to notify all admins
export async function notifyAllAdmins({ type, title, message, link }: Omit<CreateAdminNotificationParams, "adminId">) {
  return createAdminNotification({ type, title, message, link })
}
