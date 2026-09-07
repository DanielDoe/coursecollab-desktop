"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ChevronRight } from "lucide-react"

interface ToggleItem {
  id: string
  label: string
  description?: string
}

interface ToggleListProps {
  title: string
  items: ToggleItem[]
  values: Record<string, boolean>
  onChange?: (id: string, value: boolean) => void
}

export function ToggleList({ title, items, values, onChange }: ToggleListProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:border-purple-300 transition-colors"
          >
            <div className="flex-1">
              <Label htmlFor={item.id} className="text-sm font-medium text-slate-900 cursor-pointer">
                {item.label}
              </Label>
              {item.description && (
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={item.id}
                checked={values[item.id] ?? false}
                onCheckedChange={(checked) => onChange?.(item.id, checked)}
                className="data-[state=checked]:bg-purple-600"
              />
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
