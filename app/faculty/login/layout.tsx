import { AuthProvider } from "@/lib/auth-context"
import { BrandSurfaceChromeSync } from "@/components/brand-surface-chrome-sync"

/**
 * `cc-brand-surface` pins the --cc-* tokens to PVAMU purple + gold (see
 * globals.css) so the faculty sign-in screen looks the same for everyone
 * rather than inheriting whichever of the ~28 app themes that browser has
 * saved. Light/dark still follows the OS.
 */
export default function FacultyLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <BrandSurfaceChromeSync />
      <div className="cc-brand-surface cc-brand-auth min-h-[100dvh]">{children}</div>
    </AuthProvider>
  )
}
