"use client"

import { useState, useEffect } from "react"
import { AIChatInterface } from "./AIChatInterface"
import { CoraBotMark } from "@/components/cora/CoraBotMark"
import { CodeReplay } from "./CodeReplay"
import { ErrorSpotting } from "./ErrorSpotting"
import { CodeStyleReview } from "./CodeStyleReview"
import { WhatIfExplorer } from "./WhatIfExplorer"
import { CodebenchAskCoraPanel } from "./CodebenchAskCoraPanel"
import { cn } from "@/lib/utils"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { CORA_NAME, CORA_WALKTHROUGH_LABEL } from "@/lib/cora/constants"
import type { CoraThinkingMode } from "@/lib/cora/thinking-process"

interface AIResponsePanelProps {
  explanation?: string
  debugResult?: {
    errors: string[]
    fixes: string[]
    correctedCode: string
    explanation: string
    lineNumbers?: number[]
    lineNumberCorrections?: Record<number, number>
  }
  improvedCode?: {
    improvedCode: string
    diffSummary: string
    principles: string[]
  }
  pseudocode?: {
    pseudocode: string
    algorithm: string
    flowchart: string
  }
  activeTab: string | null
  onTabChange: (tab: string) => void
  code: string
  studentId: string | null
  language?: string
  cachedChats?: Map<string, any[]>
  onChatUpdate?: (mode: string, messages: any[]) => void
  getCacheKey?: (mode: string, code: string) => string
  replaySteps?: any[]
  suspiciousLines?: any[]
  styleIssues?: any[]
  onHighlightLine?: (lineNumber: number) => void
  onClearHighlight?: () => void
  onHighlightLineWithError?: (lineNumber: number, highlight: boolean) => void
  onMarkResolved?: (lineNumber: number) => void
  onSimulateWhatIf?: (question: string) => Promise<any[]>
  learningMode?: "beginner" | "intermediate" | "expert"
  theme?: "light" | "dark"
  onWalkWithCora?: () => void
  onTrySampleWalkthrough?: () => void
  isExplainLoading?: boolean
  isDebugLoading?: boolean
  isImproveLoading?: boolean
  isPseudocodeLoading?: boolean
  debugThinkingMode?: CoraThinkingMode
  replayProgressKey?: string
  coraAccess?: boolean
  onLockedCora?: (label: string) => void
}

export function AIResponsePanel({
  explanation,
  debugResult,
  improvedCode,
  pseudocode,
  activeTab,
  onTabChange,
  code,
  studentId,
  language = "javascript",
  cachedChats,
  onChatUpdate,
  getCacheKey,
  replaySteps = [],
  suspiciousLines = [],
  styleIssues = [],
  onHighlightLine,
  onClearHighlight,
  onHighlightLineWithError,
  onMarkResolved,
  onSimulateWhatIf,
  learningMode = "intermediate",
  theme = "dark",
  onWalkWithCora,
  onTrySampleWalkthrough,
  isExplainLoading = false,
  isDebugLoading = false,
  isImproveLoading = false,
  isPseudocodeLoading = false,
  debugThinkingMode = "debug",
  replayProgressKey,
  coraAccess = true,
  onLockedCora,
}: AIResponsePanelProps) {
  const isLight = theme === "light"
  const { roles } = useCodebenchChrome()
  const [showReplay, setShowReplay] = useState(replaySteps.length > 0)
  const [showErrorSpotting, setShowErrorSpotting] = useState(false)
  const [showStyleReview, setShowStyleReview] = useState(false)
  const [showWhatIf, setShowWhatIf] = useState(false)
  
  // Helper to get cached messages for a mode
  const getCachedMessages = (mode: string): any[] | undefined => {
    if (!cachedChats || !getCacheKey) return undefined
    const cacheKey = getCacheKey(mode, code)
    return cachedChats.get(cacheKey)
  }
  
  // Auto-show replay when explain tab is active and we have steps
  useEffect(() => {
    if (activeTab === "explain" && (replaySteps.length > 0 || isExplainLoading)) {
      setShowReplay(true)
    }
  }, [activeTab, replaySteps.length, isExplainLoading])
  
  // Auto-show error spotting when debug tab is active and we have suspicious lines
  useEffect(() => {
    if (activeTab === "debug" && suspiciousLines.length > 0) {
      setShowErrorSpotting(true)
    }
  }, [activeTab, suspiciousLines.length])
  
  // Auto-show style review when improve tab is active and we have issues
  useEffect(() => {
    if (activeTab !== "debug") setShowWhatIf(false)
  }, [activeTab])

  useEffect(() => {
    if (activeTab === "improve" && styleIssues.length > 0) {
      setShowStyleReview(true)
    }
  }, [activeTab, styleIssues.length])
  // Don't render if no tab is selected - show operation selection buttons
  if (!activeTab) {
    return (
      <div
        className={cn(
          "h-full flex flex-col items-center justify-center p-4 sm:p-6",
          "bg-[var(--card)]",
        )}
      >
        <div className="w-full max-w-md text-center space-y-5">
          <CoraBotMark size="lg" idle className="mx-auto" />
          <div>
            <h3 className="mb-1 text-lg font-bold text-[var(--cc-text)]">
              {CORA_NAME} is ready
            </h3>
            <p className="text-sm leading-relaxed text-[var(--cc-text-muted)]">
              Pick a Cora tool above to explain, debug, walk through, or improve this code.
            </p>
          </div>

          {onTrySampleWalkthrough ? (
            <button
              type="button"
              onClick={onTrySampleWalkthrough}
              className="w-full rounded-xl border-0 px-4 py-3 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
            >
              {CORA_WALKTHROUGH_LABEL}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--card)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "explain" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {showReplay && (replaySteps.length > 0 || isExplainLoading) ? (
              <CodeReplay
                code={code}
                steps={replaySteps}
                isLoading={isExplainLoading}
                theme={theme}
                studentId={studentId}
                progressCacheKey={replayProgressKey}
                onHighlightLine={onHighlightLine || (() => {})}
                onClearHighlight={onClearHighlight || (() => {})}
                onShowExplanation={() => setShowReplay(false)}
              />
            ) : (
              <AIChatInterface
                code={code}
                studentId={studentId}
                language={language}
                mode="explain"
                initialMessage={explanation}
                learningMode={learningMode}
                cachedMessages={getCachedMessages("explain")}
                onMessagesChange={(messages) => onChatUpdate?.("explain", messages)}
                replaySteps={replaySteps}
                showReplay={showReplay}
                onToggleReplay={() => setShowReplay(!showReplay)}
                theme={theme}
                hideHeader
                awaitingResponse={isExplainLoading && !explanation}
                thinkingMode="explain"
                coraAccess={coraAccess}
                onLockedCora={onLockedCora}
              />
            )}
          </div>
        ) : null}

        {activeTab === "debug" ? (
          showErrorSpotting && suspiciousLines.length > 0 ? (
            <ErrorSpotting
              suspiciousLines={suspiciousLines}
              onHighlightLine={onHighlightLineWithError || (() => {})}
              onMarkResolved={onMarkResolved || (() => {})}
              onToggleDebug={() => setShowErrorSpotting(!showErrorSpotting)}
              showDebug={!showErrorSpotting}
              theme={theme}
            />
          ) : showWhatIf && onSimulateWhatIf ? (
            <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <div className="absolute top-2 right-2 z-10">
                <button
                  type="button"
                  onClick={() => setShowWhatIf(false)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs transition-all",
                    isLight
                      ? "border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "border border-white/20 bg-white/10 text-slate-200 hover:bg-white/15",
                  )}
                >
                  Back to debug
                </button>
              </div>
              <WhatIfExplorer code={code} onSimulate={onSimulateWhatIf} theme={theme} />
            </div>
          ) : (
            <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                {suspiciousLines.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowErrorSpotting(true)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs transition-all",
                      isLight ? "border border-red-300 bg-red-100 text-red-700 hover:bg-red-200" : "border border-red-500/30 bg-red-500/20 text-red-300 hover:bg-red-500/30",
                    )}
                  >
                    Show Bugs
                  </button>
                ) : null}
                {onSimulateWhatIf ? (
                  <button
                    type="button"
                    onClick={() => setShowWhatIf(true)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs transition-all",
                      isLight
                        ? "border border-violet-300 bg-violet-100 text-violet-700 hover:bg-violet-200"
                        : "border border-violet-500/30 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30",
                    )}
                  >
                    What-if
                  </button>
                ) : null}
              </div>
              <AIChatInterface
                code={code}
                studentId={studentId}
                language={language}
                mode="debug"
                initialMessage={debugResult?.explanation}
                learningMode={learningMode}
                cachedMessages={getCachedMessages("debug")}
                onMessagesChange={(messages) => onChatUpdate?.("debug", messages)}
                onHighlightLineWithError={onHighlightLineWithError}
                debugLineNumbers={debugResult?.lineNumbers || []}
                lineNumberCorrections={debugResult?.lineNumberCorrections}
                theme={theme}
                hideHeader
                awaitingResponse={isDebugLoading && !debugResult?.explanation}
                thinkingMode={debugThinkingMode}
                coraAccess={coraAccess}
                onLockedCora={onLockedCora}
              />
            </div>
          )
        ) : null}

        {activeTab === "improve" ? (
          <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {showStyleReview && styleIssues.length > 0 ? (
              <CodeStyleReview issues={styleIssues} onHighlightLine={onHighlightLine || (() => {})} theme={theme} />
            ) : (
              <AIChatInterface
                code={code}
                studentId={studentId}
                language={language}
                mode="improve"
                initialMessage={improvedCode?.diffSummary}
                learningMode={learningMode}
                cachedMessages={getCachedMessages("improve")}
                onMessagesChange={(messages) => onChatUpdate?.("improve", messages)}
                theme={theme}
                hideHeader
                awaitingResponse={isImproveLoading && !improvedCode?.diffSummary}
                thinkingMode="improve"
                coraAccess={coraAccess}
                onLockedCora={onLockedCora}
              />
            )}
            {styleIssues.length > 0 ? (
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => setShowStyleReview(!showStyleReview)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs transition-all",
                    isLight ? "border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30",
                  )}
                >
                  {showStyleReview ? "Show Improvements" : "📋 Style Review"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "pseudocode" ? (
          <AIChatInterface
            code={code}
            studentId={studentId}
            language={language}
            mode="pseudocode"
            initialMessage={pseudocode?.pseudocode}
            learningMode={learningMode}
            cachedMessages={getCachedMessages("pseudocode")}
            onMessagesChange={(messages) => onChatUpdate?.("pseudocode", messages)}
            theme={theme}
            hideHeader
            awaitingResponse={isPseudocodeLoading && !pseudocode?.pseudocode}
            thinkingMode="pseudocode"
            coraAccess={coraAccess}
            onLockedCora={onLockedCora}
          />
        ) : null}

        {activeTab === "tutor" ? (
          <CodebenchAskCoraPanel
            code={code}
            studentId={studentId}
            language={language}
            learningMode={learningMode}
            cachedMessages={getCachedMessages("tutor")}
            onMessagesChange={(messages) => onChatUpdate?.("tutor", messages)}
            theme={theme}
            hideChrome
            codebenchCora
            coraAccess={coraAccess}
            onLockedCora={onLockedCora}
          />
        ) : null}
      </div>
    </div>
  )
}

