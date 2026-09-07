"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Zap, Lock, Sparkles } from "lucide-react"
import Link from "next/link"
import {
  SUPERPOWER_CONFIG,
  SUPERPOWER_SELECTION_RULES,
  type SuperpowerId,
} from "@/lib/superpowers-constants"
import type { MembershipTier } from "@/lib/membership-constants"

interface SuperpowersSelectorProps {
  enabled: boolean
  allowedSuperpowers: SuperpowerId[]
  membershipTier: MembershipTier
  selectedSuperpowers: SuperpowerId[]
  onSelectionChange: (selected: SuperpowerId[]) => void
  onValidationChange?: (isValid: boolean) => void
  assessmentLabel?: string
}

export function SuperpowersSelector({
  enabled,
  allowedSuperpowers,
  membershipTier,
  selectedSuperpowers,
  onSelectionChange,
  onValidationChange,
  assessmentLabel = "quiz",
}: SuperpowersSelectorProps) {
  const [tier, setTier] = useState<MembershipTier>(membershipTier)

  useEffect(() => {
    const stored = sessionStorage.getItem("studentMembershipTier") as MembershipTier
    const effective =
      ["Explorer", "Trailblazer"].includes(membershipTier)
        ? membershipTier
        : stored && ["Explorer", "Trailblazer"].includes(stored)
          ? stored
          : (membershipTier || stored || "Scholar") as MembershipTier
    setTier(effective)
  }, [membershipTier])

  const rules = SUPERPOWER_SELECTION_RULES[tier] ?? SUPERPOWER_SELECTION_RULES.Scholar
  const isFree = tier === "Scholar"
  const canSelect = !isFree
  const maxSlots = tier === "Explorer" ? 1 : 2

  const toggle = (id: SuperpowerId) => {
    if (!canSelect) return
    if (id === "none") {
      onSelectionChange([])
      return
    }
    const idx = selectedSuperpowers.indexOf(id)
    let next: SuperpowerId[]
    if (idx >= 0) {
      next = selectedSuperpowers.filter((_, i) => i !== idx)
    } else {
      if (tier === "Explorer") {
        next = [id]
      } else {
        next = [...selectedSuperpowers, id].slice(-2)
      }
    }
    onSelectionChange(next)
  }

  const isValid =
    tier === "Scholar"
      ? true
      : tier === "Explorer"
      ? selectedSuperpowers.length === 1
      : true

  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  if (!enabled || allowedSuperpowers.length === 0) return null

  const displayList = allowedSuperpowers.filter((s) => s !== "none")
  if (displayList.length === 0) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200/80 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-100/90 dark:from-slate-900 dark:via-amber-950/30 dark:to-slate-900 shadow-lg shadow-amber-500/10">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-400/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="relative p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
              Choose Your Superpowers
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {tier === "Explorer" && "Pick 1 power to boost your run"}
              {tier === "Trailblazer" && "Pick up to 2 powers to boost your run"}
              {tier === "Scholar" && "Unlock powers with Explorer or Trailblazer"}
            </p>
          </div>
        </div>

        {isFree ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {displayList.map((id) => {
                const cfg = SUPERPOWER_CONFIG[id]
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm opacity-70"
                  >
                    <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400 truncate">
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <Link href="/student/upgrade">
              <Button className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 rounded-xl">
                <Sparkles className="h-4 w-4 mr-2" />
                Upgrade to Explorer or Trailblazer
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Slot indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Your picks:</span>
              <span className="inline-flex gap-1">
                {Array.from({ length: maxSlots }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < selectedSuperpowers.length
                        ? "bg-amber-500 text-white dark:bg-amber-900/80"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {i < selectedSuperpowers.length ? "✓" : i + 1}
                  </span>
                ))}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {tier === "Explorer" ? "1 of 1" : `${selectedSuperpowers.length} of 2`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {displayList.map((id) => {
                const cfg = SUPERPOWER_CONFIG[id]
                const isSelected = selectedSuperpowers.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={`group relative flex flex-col items-start gap-1 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      isSelected
                        ? "bg-amber-100/90 dark:bg-amber-900/40 border-amber-500 dark:border-amber-600 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50"
                        : "bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md hover:bg-amber-50/50 dark:hover:bg-amber-950/30"
                    }`}
                  >
                    <span className="text-2xl">{cfg.icon}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {cfg.description}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {tier === "Explorer" && selectedSuperpowers.length !== 1 && (
              <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 font-medium">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900/50 flex items-center justify-center text-xs">
                  1
                </span>
                Pick exactly 1 superpower to continue
              </p>
            )}
            {tier === "Trailblazer" && selectedSuperpowers.length > 2 && (
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                You can select up to 2 superpowers (or none)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
