/** Admin dashboard v2 navigation - used by Sidebar and Topbar search */

import { ADMIN_DASHBOARD_LINK, ADMIN_NAV_GROUPS } from "./admin-nav-config"

export type AdminNavModule = {
  id: string
  label: string
  href: string
  group: string
}

export const ADMIN_DASHBOARD_V2_MODULES: AdminNavModule[] = [
  { id: ADMIN_DASHBOARD_LINK.id, label: ADMIN_DASHBOARD_LINK.label, href: ADMIN_DASHBOARD_LINK.href, group: "Main" },
  ...ADMIN_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      group: group.title,
    })),
  ),
]

export function searchAdminModules(query: string): AdminNavModule[] {
  const q = query.trim().toLowerCase()
  if (!q) return ADMIN_DASHBOARD_V2_MODULES
  return ADMIN_DASHBOARD_V2_MODULES.filter(
    (m) => m.label.toLowerCase().includes(q) || m.group.toLowerCase().includes(q),
  )
}
