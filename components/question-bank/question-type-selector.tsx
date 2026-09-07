"use client"

import { Sparkles, Plus } from "lucide-react"
import {
  QUESTION_BANK_TYPE_CATEGORIES,
  QUESTION_BANK_TYPES,
} from "@/lib/question-bank-type-config"
import { customTypeToMeta, type CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import { questionBankCardClass, questionBankCardHoverClass } from "@/lib/question-bank-ui"
import { cn } from "@/lib/utils"

export function QuestionTypeSelector({
  value,
  onChange,
  customTypes = [],
  onCreateNewType,
}: {
  value: string | null
  onChange: (type: string) => void
  customTypes?: CustomQuestionTypeDraft[]
  onCreateNewType?: () => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Question type</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Choose a built-in or saved custom type — or create a new one with AI.
        </p>
      </div>

      {customTypes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your custom types</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {customTypes.map((type) => {
              const meta = customTypeToMeta(type)
              const selected = value === type.typeId
              return (
                <button
                  key={type.typeId}
                  type="button"
                  onClick={() => onChange(type.typeId)}
                  className={cn(
                    questionBankCardClass,
                    !selected && questionBankCardHoverClass,
                    "flex items-start gap-2.5 p-3 text-left",
                    selected && "border-slate-900 ring-1 ring-slate-900/10 dark:border-slate-300 dark:ring-slate-300/20",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/40">
                    <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 block leading-snug">
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block line-clamp-2 leading-relaxed">
                      {meta.description}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {QUESTION_BANK_TYPE_CATEGORIES.map((cat) => {
        const types = QUESTION_BANK_TYPES.filter((t) => t.category === cat.id)
        return (
          <div key={cat.id} className="space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{cat.label}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((type) => {
                const Icon = type.icon
                const selected = value === type.id
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => onChange(type.id)}
                    className={cn(
                      questionBankCardClass,
                      !selected && questionBankCardHoverClass,
                      "flex items-start gap-2.5 p-3 text-left",
                      selected && "border-slate-900 ring-1 ring-slate-900/10 dark:border-slate-300 dark:ring-slate-300/20",
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 block leading-snug">
                        {type.label}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block line-clamp-2 leading-relaxed">
                        {type.description}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {onCreateNewType ? (
        <button
          type="button"
          onClick={onCreateNewType}
          className={cn(
            questionBankCardClass,
            questionBankCardHoverClass,
            "flex w-full items-center gap-3 p-4 text-left border-dashed",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/40">
            <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 block">
              Create new question type
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
              Describe a format that does not exist yet — AI builds the schema and saves it for reuse.
            </span>
          </div>
        </button>
      ) : null}
    </div>
  )
}
