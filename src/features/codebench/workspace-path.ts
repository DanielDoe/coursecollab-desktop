export function isCodebenchWorkspacePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname.includes('/codebench/ide')
}
