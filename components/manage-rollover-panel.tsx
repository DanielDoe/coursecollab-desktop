"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Clock } from "lucide-react"

interface ManageRolloverPanelProps {
  rolloverEnabled: boolean
  rolloverHours: number
  onRolloverEnabledChange: (value: boolean) => void
  onRolloverHoursChange: (value: number) => void
  assessmentLabel: string
  disabled?: boolean
  embedded?: boolean
}

export function ManageRolloverPanel({
  rolloverEnabled,
  rolloverHours,
  onRolloverEnabledChange,
  onRolloverHoursChange,
  assessmentLabel,
  disabled = false,
  embedded = false,
}: ManageRolloverPanelProps) {
  const content = (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex-1">
          <Label htmlFor="rollover_enabled" className="cursor-pointer font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Allow Explorer & Trailblazer rollover
          </Label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Trailblazer members who missed the deadline can request an extension. Clock starts when they apply.
          </p>
        </div>
        <Switch
          id="rollover_enabled"
          checked={rolloverEnabled}
          onCheckedChange={onRolloverEnabledChange}
          disabled={disabled}
        />
      </div>

      {rolloverEnabled && (
        <div className="space-y-2 pl-2 border-l-4 border-amber-500 ml-2">
          <Label htmlFor="rollover_hours" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Extension hours
          </Label>
          <Input
            id="rollover_hours"
            type="number"
            min={1}
            max={72}
            value={rolloverHours}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10)
              if (!Number.isNaN(val) && val >= 1 && val <= 72) {
                onRolloverHoursChange(val)
              }
            }}
            className="w-24 rounded-xl border-slate-200 dark:border-slate-700"
            disabled={disabled}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hours from when the student applies until the extension expires (1–72)
          </p>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">Trailblazer Rollover</h4>
        </div>
        {content}
      </div>
    )
  }

  return (
    <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all rounded-2xl">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
        <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Trailblazer Rollover
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {content}
      </CardContent>
    </Card>
  )
}
