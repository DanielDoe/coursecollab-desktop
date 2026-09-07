import { getFacultyNavGroupTheme } from './faculty-module-themes'
import { getStudentModuleTheme } from './student-module-themes'
import { themeFromFamily, PORTAL_DEFAULT_FAMILY, type PortalModuleThemeTokens } from './portal-module-themes'

export type MessagesPortal = 'student' | 'instructor' | 'guest' | 'camp'

export function getMessagesPortalTheme(portal: MessagesPortal): PortalModuleThemeTokens {
  if (portal === 'student') return getStudentModuleTheme('messages')
  if (portal === 'instructor') return getFacultyNavGroupTheme('communication')
  return themeFromFamily(PORTAL_DEFAULT_FAMILY)
}
