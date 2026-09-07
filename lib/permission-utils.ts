/** Client-safe permission helpers (no database imports). */

export function hasPermission(permissions: string[], code: string): boolean {
  return permissions.includes(code)
}

export function hasAnyPermission(permissions: string[], codes: string[]): boolean {
  return codes.some((c) => permissions.includes(c))
}
