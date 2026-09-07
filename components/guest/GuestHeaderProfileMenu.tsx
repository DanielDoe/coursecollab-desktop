"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, Crown, Sparkles, LogOut, Settings } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { logoutStudent } from "@/lib/auth"
import {
  ProfileAvatarWithPresence,
  ProfileDropdownPresenceBlock,
  ProfileRoleWithStatus,
} from "@/components/presence/HeaderProfilePresence"
import {
  portalDropdown,
  portalDropdownItem,
  portalNavLink,
} from "@/lib/appearance/portal-shell-theme"
import { cn } from "@/lib/utils"
import { initialsFromName } from "@/lib/initials-from-name"

function getInitials(name?: string | null) {
  if (!name?.trim()) return "G"
  return initialsFromName(name)
}

type GuestHeaderProfileMenuProps = {
  name?: string | null
  email?: string | null
}

export function GuestHeaderProfileMenu({ name, email }: GuestHeaderProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const displayName = name?.trim() || "Guest"

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open profile menu"
        className={cn(portalNavLink, "h-auto px-2.5 py-2 sm:py-1.5")}
      >
        <ProfileAvatarWithPresence>
          <Avatar className="size-8 border-2 border-[var(--border)]">
            <AvatarFallback className="bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] text-xs font-semibold">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
        </ProfileAvatarWithPresence>
        <span className="hidden sm:inline max-w-[8rem] truncate">{displayName}</span>
        <ChevronDown className="hidden sm:block h-4 w-4 text-[var(--cc-text-muted)] shrink-0" />
      </Button>

      {open && (
        <div className={portalDropdown}>
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="font-semibold text-[var(--cc-text)] truncate">{displayName}</p>
            {email ? (
              <>
                <p className="text-xs text-[var(--cc-text-muted)] mt-1 truncate">{email}</p>
                <ProfileRoleWithStatus role="Guest · Career portal" className="mt-1.5" />
              </>
            ) : (
              <ProfileRoleWithStatus role="Guest · Career portal" />
            )}
          </div>
          <ProfileDropdownPresenceBlock onSelect={() => setOpen(false)} />
          <div className="py-2">
            <Link
              href="/guest/cora-career/access"
              onClick={() => setOpen(false)}
              className={portalDropdownItem}
            >
              <Crown className="h-4 w-4" />
              Cora Career
            </Link>
            <Link
              href="/guest/cora-credits"
              onClick={() => setOpen(false)}
              className={portalDropdownItem}
            >
              <Sparkles className="h-4 w-4" />
              Cora Credits
            </Link>

            <Link
              href="/guest/settings"
              onClick={() => setOpen(false)}
              className={portalDropdownItem}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              type="button"
              onClick={() => logoutStudent(true)}
              className={cn(
                portalDropdownItem,
                "hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10",
              )}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
