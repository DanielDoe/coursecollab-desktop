/**

 * Admin navigation — institution management IA (see admin-portal-nav-config.ts).

 */



import {

  ADMIN_DASHBOARD_LINK,

  ADMIN_NAV_GROUPS,

  isAdminGroupActive,

  isAdminItemActive as isAdminItemActivePath,

} from "@/lib/admin-portal-nav-config"



export type { NavItem, NavGroup } from "@/lib/portal-nav-config"



export { ADMIN_DASHBOARD_LINK, ADMIN_NAV_GROUPS }



export function isGroupActive(

  group: (typeof ADMIN_NAV_GROUPS)[number],

  pathname: string,

): boolean {

  return isAdminGroupActive(group, pathname)

}



export function isItemActive(

  item: (typeof ADMIN_NAV_GROUPS)[number]["items"][number],

  pathname: string,

): boolean {

  return isAdminItemActivePath(item, pathname)

}



export function isAdminItemActive(

  item: (typeof ADMIN_NAV_GROUPS)[number]["items"][number],

  pathname: string,

): boolean {

  return isAdminItemActivePath(item, pathname)

}

