"use client"

import { desktopAuth } from "@/components/auth/desktop-auth-primitives"
import { openWebAppPath } from "@/lib/desktop-auth-policy"
import { cn } from "@/lib/utils"

type DesktopWebSignupLinkProps = {
  path: string
  label?: string
  className?: string
  prompt?: string
}

/** Footer link that opens account creation on the web app. */
export function DesktopWebSignupLink({
  path,
  label = "Create account on web",
  className,
  prompt = "New here?",
}: DesktopWebSignupLinkProps) {
  return (
    <p className={cn("mt-3 text-center text-[12px] text-[var(--cc-text-muted)]", className)}>
      {prompt}{" "}
      <button
        type="button"
        onClick={() => openWebAppPath(path)}
        className={cn(desktopAuth.footerLink, "font-medium no-underline hover:underline")}
      >
        {label}
      </button>
    </p>
  )
}
