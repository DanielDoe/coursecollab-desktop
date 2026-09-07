"use client"

import { useEffect, useRef, useState } from "react"
import {
  Check,
  Circle,
  Upload,
  HelpCircle,
  Lightbulb,
  AlertTriangle,
  Info,
  ChevronRight,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CAMP_PRESENTATION_NESTED_PANEL } from "@/lib/summer-camp/camp-presentation-styles"
import type { CampBlockType, CampModuleBlock } from "@/lib/summer-camp/types"
import { CampRichMarkdown } from "@/components/summer-camp/CampRichMarkdown"
import { CampKnowledgeCheck } from "@/components/summer-camp/CampKnowledgeCheck"
import { scoreQuizAnswers } from "@/lib/summer-camp/quiz-xp-scoring"
import { CampCheckpointCompareImages } from "@/components/summer-camp/CampCheckpointCompareImages"
import { CampScaledImage } from "@/components/summer-camp/CampScaledImage"
import { CampColumnGridBlock } from "@/components/summer-camp/camp-column-grid-block"
import { CampTextBlockView } from "@/components/summer-camp/camp-text-block-view"
import { CampPositionableImage } from "@/components/summer-camp/camp-positionable-image"
import { normalizeImageTransform } from "@/lib/summer-camp/image-layout"
import { parseTextBlockSideLayout } from "@/lib/summer-camp/text-block-layout"
import { useCampPresentation } from "@/components/summer-camp/camp-presentation-context"
import { useCampLecture } from "@/components/summer-camp/camp-lecture-context"
import { isLectureContentBlock } from "@/lib/summer-camp/lecture-mode"
import {
  CampDemoFlowBlock,
  CampExampleCardsBlock,
  CampExcitementFeedbackBlock,
  CampFacultyCardsBlock,
  CampHeroBlock,
  CampMissionObjectivesBlock,
  CampModuleCompletionBlock,
  CampProfileFormBlock,
  CampRoadmapMapBlock,
  CampStartJourneyBlock,
  CampWelcomeIntroBlock,
  CampComparisonTableBlock,
  CampMatchingPairsBlock,
  CampTrainingPipelineBlock,
  CampProgrammingFlowBlock,
  CampAiHierarchyBlock,
  CampIndustrySectorsBlock,
  CampIndustrySpotlightBlock,
  CampModuleReflectionBlock,
  CampPatternGalleryBlock,
  CampMlCompareBlock,
  CampVerticalPipelineBlock,
  CampStepOrderBlock,
  CampTrainingLoopBlock,
  CampTrainingSimulationBlock,
  CampPredictionFlowBlock,
  CampPredictionChallengeBlock,
  CampBrainNetworkBlock,
  CampDlApplicationsBlock,
  CampProjectArchitectureBlock,
  CampMiniProjectBlock,
  CampDataTypesGalleryBlock,
} from "@/components/summer-camp/camp-special-blocks"
import {
  CampVisionObserveBlock,
  CampVisionPipelineCompareBlock,
  CampPixelZoomBlock,
  CampRgbToolBlock,
  CampDogVsMatrixBlock,
  CampCvFeaturePipelineBlock,
  CampCatDogCompareBlock,
  CampCvTasksBlock,
  CampBoundingBoxDemoBlock,
  CampTaskSortBlock,
  CampDetectionScoresBlock,
  CampDetectionViewerBlock,
  CampOdUseCasesBlock,
  CampHumanVsAiBlock,
  CampVisionDesignBlock,
  CampSegmentationDemoBlock,
} from "@/components/summer-camp/camp-cv-blocks"
import {
  CampAiTypeCardsBlock,
  CampConceptCardsBlock,
  CampDualModelCompareBlock,
  CampFeatureCardGridBlock,
  CampHandsOnMissionsBlock,
  CampIndustrialCompareBlock,
  CampModernSurface,
  CampMythFactCarouselBlock,
  CampFlashcardCarouselBlock,
  CampNumberedStepsBlock,
  CampPollOptionGrid,
  CampPromptWorkshopBlock,
  CampTopicDeckBlock,
  CampWaveCardsBlock,
} from "@/components/summer-camp/camp-modern-blocks"
import {
  CampIotNetworkFlowBlock,
  CampSensorGalleryBlock,
  CampSensorMatchBlock,
  CampConnectivityMatchBlock,
  CampIotComponentsBlock,
  CampIotSystemFlowBlock,
  CampDataExplosionBlock,
  CampEdgeChoiceBlock,
  CampIotAiPipelineBlock,
  CampIotAiExamplesBlock,
  CampIotSystemBuilderBlock,
  CampIotApplicationsBlock,
} from "@/components/summer-camp/camp-iot-blocks"
import {
  CampCloudFlowBlock,
  CampCloudBenefitsBlock,
  CampLatencyWorkflowBlock,
  CampLatencyDemoBlock,
  CampCloudVsEdgeBlock,
  CampEdgeBenefitsBlock,
  CampEdgeBenefitMatchBlock,
  CampEdgeApplicationsBlock,
  CampEdgeDeviceGalleryBlock,
  CampPiHardwarePreviewBlock,
  CampCloudEdgeSortBlock,
  CampEdgeJourneyBlock,
} from "@/components/summer-camp/camp-edge-blocks"
import {
  CampSmartCameraPollBlock,
  CampEdgeAiFormulaBlock,
  CampIntelligenceEvolutionBlock,
  CampEdgeAiArchitectureBlock,
  CampEdgeAiChallengesBlock,
  CampCloudVsPiBlock,
  CampCapstonePipelineBlock,
  CampCapstoneStepsBlock,
  CampTfliteCompareBlock,
  CampEdgeAiDesignBlock,
  CampEdgeAiFutureBlock,
} from "@/components/summer-camp/camp-edge-ai-blocks"
import {
  CampPiHeroBlock,
  CampPiAiPollBlock,
  CampDesktopVsPiBlock,
  CampPiWhyLoveBlock,
  CampPiHardwareExplorerBlock,
  CampPiComponentMatchBlock,
  CampPiEdgeDiagramBlock,
  CampPiRealWorldBlock,
  CampCameraModuleBlock,
  CampCameraRequiredPollBlock,
  CampPiEcosystemBlock,
  CampPiSetupBuilderBlock,
  CampPiSafetyBlock,
  CampPiProjectWalkthroughBlock,
  CampPiMissionPreviewBlock,
} from "@/components/summer-camp/camp-pi-blocks"
import {
  CampPiSetupMissionBlock,
  CampHardwareInventoryBlock,
  CampHardwareKitLayoutBlock,
  CampBootProcessBlock,
  CampPiAssemblyStepsBlock,
  CampCameraOrientationBlock,
  CampOsInstallTrackerBlock,
  CampPiImagerWorkflowBlock,
  CampLedIndicatorsBlock,
  CampPiConfigTourBlock,
  CampDesktopTourBlock,
  CampTerminalCommandsBlock,
  CampCameraVerifyBlock,
  CampPiTroubleshootingBlock,
  CampMissionSuccessBlock,
} from "@/components/summer-camp/camp-pi-setup-blocks"
import {
  CampTfliteMissionBlock,
  CampGiantModelPollBlock,
  CampTfliteWhyBlock,
  CampTrainingVsInferenceBlock,
  CampInferencePollBlock,
  CampCommandLessonBlock,
  CampGitQuizBlock,
  CampFolderPathBlock,
  CampSetupScriptBlock,
  CampLibAtlasBlock,
  CampAiModelVisualizerBlock,
  CampVerifyInstallBlock,
  CampFirstAiDemoBlock,
  CampTfliteTroubleshootingBlock,
  CampAiEnvironmentStatusBlock,
} from "@/components/summer-camp/camp-tflite-blocks"
import {
  CampOpencvMissionBlock,
  CampOpencvPixelsPollBlock,
  CampCvEnvironmentStatusBlock,
} from "@/components/summer-camp/camp-opencv-blocks"
import { CampCodeLabBlock } from "@/components/summer-camp/camp-code-lab-block"
import {
  CampFaceEyeMissionBlock,
  CampFaceDetectionWorkflowBlock,
  CampEyeDetectionWorkflowBlock,
  CampFaceEyeEngineerPollBlock,
  CampFaceEyePipelineBlock,
  CampFaceEyeBoundingLegendBlock,
  CampFaceEyeSampleGalleryBlock,
  CampFaceEyeRunSuccessBlock,
  CampFaceEyeInvestigationBlock,
  CampFaceEyeTroubleshootingBlock,
  CampFaceEyeMissionAccomplishedBlock,
} from "@/components/summer-camp/camp-face-eye-blocks"
import {
  CampOdMissionBlock,
  CampOpeningChallengeBlock,
  CampAiAccuracyPollBlock,
  CampOdDefinitionBlock,
  CampOdResultVisualizationBlock,
  CampManualBoundingBoxBlock,
  CampConfidenceCompareBlock,
  CampConfidenceVisualBlock,
  CampModelClassGalleryBlock,
  CampRunDetectionBlock,
  CampDetectionDataTableBlock,
  CampConfuseAiBlock,
  CampOdPipelineAnimBlock,
  CampOdJourneyBlock,
  CampOdSecurityDesignBlock,
  CampMissionAccomplishedBlock,
  CampOdInvestigationBlock,
  CampOdDesignChallengeBlock,
} from "@/components/summer-camp/camp-od-deployment-blocks"
import {
  CampShowcaseJourneyBlock,
  CampShowcaseObjectivesBlock,
  CampVideoDemoGuideBlock,
  CampScreenshotGuideBlock,
  CampReflectionReportGuideBlock,
  CampShowcaseRubricBlock,
  CampAchievementSummaryBlock,
  CampCertificateRequirementsBlock,
  CampCertificateAwardBlock,
  CampFinalSurveyBlock,
  CampGraduationBlock,
} from "@/components/summer-camp/camp-showcase-blocks"

function toVideoEmbedUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  if (trimmed.includes("/embed/")) return trimmed
  const watch = trimmed.match(/[?&]v=([^&]+)/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const short = trimmed.match(/youtu\.be\/([^?&]+)/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  return trimmed
}

function toYouTubeWatchUrl(embedOrWatchUrl: string): string | null {
  const embed = embedOrWatchUrl.match(/\/embed\/([^?&]+)/)
  if (embed) return `https://www.youtube.com/watch?v=${embed[1]}`
  if (embedOrWatchUrl.includes("youtube.com/watch")) return embedOrWatchUrl
  const short = embedOrWatchUrl.match(/youtu\.be\/([^?&]+)/)
  if (short) return `https://www.youtube.com/watch?v=${short[1]}`
  return null
}

type QuizQuestion = {
  id: string
  prompt: string
  options: string[]
  correctIndex?: number
  correctIndices?: number[]
  multiSelect?: boolean
  trueFalse?: boolean
}

export type BlockProgressMap = Record<string, Record<string, unknown>>

function CampEditableImagePreview({
  content,
  layoutEditable,
  onContentChange,
}: {
  content: Record<string, unknown>
  layoutEditable?: boolean
  onContentChange?: (content: Record<string, unknown>) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const transform = normalizeImageTransform(content)

  if (layoutEditable && onContentChange) {
    return (
      <div
        ref={canvasRef}
        className="relative min-h-[280px] w-full rounded-xl border border-dashed border-violet-300/40 bg-white/30 dark:bg-slate-900/20 p-2"
      >
        <CampPositionableImage
          containerRef={canvasRef}
          imageUrl={String(content.imageUrl ?? "")}
          caption={String(content.caption ?? "")}
          alt={String(content.alt ?? content.caption ?? "Module image")}
          transform={transform}
          editable
          onTransformChange={(patch) => onContentChange({ ...content, ...patch })}
        />
      </div>
    )
  }

  return (
    <CampPositionableImage
      imageUrl={String(content.imageUrl ?? "")}
      caption={String(content.caption ?? "")}
      alt={String(content.alt ?? content.caption ?? "Module image")}
      transform={transform}
    />
  )
}

interface CampBlockRendererProps {
  block: CampModuleBlock
  isStepComplete?: boolean
  submission?: { id: number; status: string; feedback?: string | null; file_name?: string | null } | null
  blockProgress?: BlockProgressMap
  onMarkStep?: (blockId: number) => void
  onSubmitCheckpoint?: (blockId: number, file: File) => void
  onNeedHelp?: (blockId: number) => void
  onSaveProgress?: (
    blockId: number,
    progressType: string,
    metadata: Record<string, unknown>,
  ) => Promise<void>
  onSaveProfile?: (patch: Record<string, unknown>) => Promise<void | { ok: boolean; error?: string }>
  onContinueModuleSections?: () => void
  onOpenSupport?: () => void
  onScrollDiscussion?: () => void
  camperProfile?: Record<string, unknown>
  isModuleComplete?: boolean
  moduleRewards?: { xp?: number; badges?: string[]; nextModule?: string }
  knowledgeCheckGaps?: Array<{ label: string; blockId?: number }>
  readOnly?: boolean
  /** Instructor edit mode: drag/resize images in the camper preview. */
  layoutEditable?: boolean
  onContentChange?: (content: Record<string, unknown>) => void
  isLocked?: boolean
  onMarkSectionComplete?: (blockId: number) => Promise<void>
  omitLeadingSectionHeading?: boolean
  collapsibleMarkdownSections?: boolean
}

export function CampBlockRenderer({
  block,
  isStepComplete,
  submission,
  blockProgress,
  onMarkStep,
  onSubmitCheckpoint,
  onNeedHelp,
  onSaveProgress,
  onSaveProfile,
  onContinueModuleSections,
  onOpenSupport,
  onScrollDiscussion,
  camperProfile,
  isModuleComplete,
  moduleRewards,
  knowledgeCheckGaps,
  readOnly,
  layoutEditable,
  onContentChange,
  isLocked,
  onMarkSectionComplete,
  omitLeadingSectionHeading,
  collapsibleMarkdownSections = true,
}: CampBlockRendererProps) {
  const inPresentation = useCampPresentation()
  const inLecture = useCampLecture()
  const content = block.content as Record<string, unknown>
  const savedQuiz = blockProgress?.quiz_response as
    | { answers?: Record<string, number | number[]> }
    | undefined
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number | number[]>>(
    savedQuiz?.answers ?? {},
  )
  const [uploading, setUploading] = useState(false)
  const [reflectionDraft, setReflectionDraft] = useState(
    String(blockProgress?.reflection?.text ?? blockProgress?.reflection?.selection ?? ""),
  )
  const [reflectionOption, setReflectionOption] = useState<number | null>(
    blockProgress?.reflection?.optionIndex != null
      ? Number(blockProgress.reflection.optionIndex)
      : null,
  )
  const [activitySelection, setActivitySelection] = useState<number[]>(
    (blockProgress?.engagement?.selected as number[]) ?? [],
  )
  const [activityRevealed, setActivityRevealed] = useState(
    Boolean(blockProgress?.engagement?.revealed),
  )
  const [expandedInteractive, setExpandedInteractive] = useState<string | null>(null)
  const [journeyRevealed, setJourneyRevealed] = useState(
    Boolean(blockProgress?.engagement?.journeyRevealed),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (savedQuiz?.answers) setQuizAnswers(savedQuiz.answers)
  }, [block.id, savedQuiz?.answers])

  const save = async (
    progressType: string,
    metadata: Record<string, unknown>,
    markSection = false,
  ) => {
    if (!onSaveProgress || readOnly) return
    setSaving(true)
    try {
      await onSaveProgress(block.id, progressType, metadata)
      if (markSection && onMarkSectionComplete) {
        await onMarkSectionComplete(block.id)
      }
    } finally {
      setSaving(false)
    }
  }

  const calloutIcon = (variant: string) => {
    if (variant === "warning") return <AlertTriangle className="h-4 w-4" />
    if (variant === "tip") return <Lightbulb className="h-4 w-4" />
    return <Info className="h-4 w-4" />
  }

  const handleFileUpload = async (file: File) => {
    if (!onSubmitCheckpoint) return
    setUploading(true)
    try {
      await onSubmitCheckpoint(block.id, file)
    } finally {
      setUploading(false)
    }
  }

  if (inLecture && !isLectureContentBlock(block)) return null

  switch (block.block_type as CampBlockType) {
    case "text":
      if (content.variant === "welcome_intro") {
        return <CampWelcomeIntroBlock />
      }
      return (
        <CampTextBlockView
          content={content}
          omitLeadingSectionHeading={omitLeadingSectionHeading}
          collapsibleMarkdownSections={collapsibleMarkdownSections}
          editable={layoutEditable}
          onLayoutImageChange={
            layoutEditable && onContentChange
              ? (patch) => {
                  const layout = parseTextBlockSideLayout(content)
                  if (!layout?.image) return
                  onContentChange({
                    ...content,
                    layout: { ...layout, image: { ...layout.image, ...patch } },
                  })
                }
              : undefined
          }
        />
      )

    case "callout": {
      const variant = String(content.variant ?? "tip")
      return (
        <div
          className={cn(
            "rounded-xl border p-4 flex gap-3",
            inPresentation
              ? "bg-white shadow-lg border-slate-200 text-slate-800"
              : variant === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                : variant === "tip"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : "border-violet-500/30 bg-violet-500/10 text-violet-900 dark:text-violet-100",
            inPresentation && variant === "warning" && "border-amber-300",
            inPresentation && variant === "tip" && "border-emerald-300",
            inPresentation && variant === "info" && "border-sky-300",
            inPresentation &&
              variant !== "warning" &&
              variant !== "tip" &&
              variant !== "info" &&
              "border-violet-300",
          )}
        >
          <div className="shrink-0 mt-0.5">{calloutIcon(variant)}</div>
          <p className="text-sm leading-relaxed [&_strong]:text-inherit">{String(content.text ?? "")}</p>
        </div>
      )
    }

    case "code": {
      const hasLabUi =
        content.contentType === "code_lab" ||
        Boolean(content.title) ||
        content.allowCopy === true ||
        content.allowDownload === true
      if (hasLabUi) {
        return <CampCodeLabBlock content={content} />
      }
      return (
        <div className="rounded-xl border border-dashboard-v2-border overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-500 border-b border-dashboard-v2-border">
            {String(content.language ?? "code")}
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono bg-slate-950 text-emerald-300">
            <code>{String(content.code ?? "")}</code>
          </pre>
        </div>
      )
    }

    case "column_grid":
      return (
        <CampColumnGridBlock
          content={content}
          readOnly
          layoutEditable={layoutEditable}
          onChange={
            layoutEditable && onContentChange
              ? (next) => onContentChange(next as unknown as Record<string, unknown>)
              : undefined
          }
        />
      )

    case "image":
      return (
        <CampEditableImagePreview
          content={content}
          layoutEditable={layoutEditable}
          onContentChange={onContentChange}
        />
      )

    case "step":
      return (
        <div
          className={cn(
            "rounded-xl border p-4 sm:p-5 flex gap-3 sm:gap-4 items-start shadow-sm",
            inPresentation
              ? cn(CAMP_PRESENTATION_NESTED_PANEL, "border-violet-200")
              : "border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] to-transparent",
          )}
        >
          <button
            type="button"
            disabled={readOnly || isStepComplete}
            onClick={() => onMarkStep?.(block.id)}
            className={cn(
              "shrink-0 size-9 rounded-full border-2 flex items-center justify-center transition-colors",
              isStepComplete
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-violet-300/60 dark:border-violet-500/40 bg-white/80 dark:bg-white/5 hover:border-violet-500",
            )}
            aria-label={isStepComplete ? "Step complete" : "Mark step complete"}
          >
            {isStepComplete ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4 text-violet-400" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base text-slate-900 dark:text-white">{String(content.title ?? "Step")}</p>
            <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{String(content.description ?? "")}</p>
            {!readOnly && onNeedHelp && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 text-violet-600 dark:text-violet-400"
                onClick={() => onNeedHelp(block.id)}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                Need Help?
              </Button>
            )}
          </div>
        </div>
      )

    case "checkpoint": {
      const referenceImageUrl = content.referenceImageUrl ? String(content.referenceImageUrl) : undefined
      const referenceLabel = content.referenceLabel ? String(content.referenceLabel) : "Camp demo"
      const studentLabel = content.studentLabel ? String(content.studentLabel) : "Your upload"
      const referencePlaceholder = content.referencePlaceholder
        ? String(content.referencePlaceholder)
        : "Reference screenshot — instructor will add camp demo"
      const showCompare =
        "referencePlaceholder" in content ||
        "referenceImageUrl" in content ||
        Boolean(submission?.file_url?.trim())
      return (
        <div
          className={cn(
            "rounded-xl border-2 border-dashed p-4 sm:p-5",
            inPresentation
              ? cn(CAMP_PRESENTATION_NESTED_PANEL, "border-violet-300 bg-violet-50/80")
              : "border-violet-500/40 bg-violet-500/5",
          )}
        >
          <div className="flex items-start gap-3">
            <Upload className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">
                {String(content.title ?? "Checkpoint")}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {String(content.description ?? "Upload your work to continue.")}
              </p>
              {showCompare ? (
                <CampCheckpointCompareImages
                  referenceImageUrl={referenceImageUrl}
                  referenceLabel={referenceLabel}
                  studentImageUrl={submission?.file_url}
                  studentLabel={studentLabel}
                  referencePlaceholder={referencePlaceholder}
                />
              ) : null}
              {submission && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      submission.status === "approved"
                        ? "default"
                        : submission.status === "revision_needed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {submission.status}
                  </Badge>
                  {submission.file_name && (
                    <span className="text-xs text-slate-500">{submission.file_name}</span>
                  )}
                  {submission.feedback && (
                    <p className="w-full text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Feedback: {submission.feedback}
                    </p>
                  )}
                </div>
              )}
              {!readOnly && onSubmitCheckpoint && submission?.status !== "approved" && (
                <div className="mt-3">
                  <input
                    type="file"
                    id={`checkpoint-${block.id}`}
                    className="hidden"
                    accept="image/*,video/mp4,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleFileUpload(f)
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={uploading}
                    onClick={() => document.getElementById(`checkpoint-${block.id}`)?.click()}
                  >
                    {uploading ? "Uploading…" : submission ? "Resubmit" : "Upload submission"}
                  </Button>
                </div>
              )}
              {!readOnly && onNeedHelp && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 text-violet-600"
                  onClick={() => onNeedHelp(block.id)}
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                  Need Help?
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }

    case "quiz": {
      const questions = (content.questions as QuizQuestion[]) ?? []
      return (
        <CampKnowledgeCheck
          title={String(content.title ?? "Knowledge Check")}
          questions={questions}
          initialAnswers={savedQuiz?.answers}
          readOnly={readOnly}
          saving={saving}
          onSubmit={async (answers) => {
            setQuizAnswers(answers)
            const { correct, total } = scoreQuizAnswers(questions, answers)
            await save(
              "quiz_response",
              {
                answers,
                submitted: true,
                correctCount: correct,
                totalQuestions: total,
                completedAt: new Date().toISOString(),
              },
              true,
            )
          }}
        />
      )
    }

    case "reflection": {
      const options = (content.options as string[]) ?? []
      const hasOptions = options.length > 0
      return (
        <CampModernSurface className="space-y-3">
          <p
            className={cn(
              "font-semibold flex items-center gap-2",
              inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
            )}
          >
            <Lightbulb className="h-4 w-4 text-violet-500" />
            {hasOptions ? "Student Reflection" : "Reflection Journal"}
          </p>
          <p
            className={cn(
              "text-sm leading-relaxed",
              inPresentation ? "text-slate-700" : "text-slate-700 dark:text-slate-300",
            )}
          >
            {String(content.prompt ?? "")}
          </p>
          {content.hint && (
            <p className={cn("text-xs italic", inPresentation ? "text-slate-500" : "text-slate-500")}>
              {String(content.hint)}
            </p>
          )}
          {hasOptions ? (
            <div className="flex flex-wrap gap-2">
              {options.map((opt, idx) => (
                <button
                  key={opt}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setReflectionOption(idx)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-sm",
                    reflectionOption === idx
                      ? "border-violet-500 bg-violet-500/15"
                      : "border-slate-200 dark:border-slate-700",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <Textarea
              value={reflectionDraft}
              onChange={(e) => setReflectionDraft(e.target.value)}
              placeholder="Write your reflection here…"
              rows={4}
              disabled={readOnly}
              className="resize-none bg-white/80 dark:bg-slate-900/80"
            />
          )}
          {!readOnly && onSaveProgress && (
            <Button
              size="sm"
              disabled={saving || (hasOptions ? reflectionOption == null : !reflectionDraft.trim())}
              onClick={async () => {
                const meta = hasOptions
                  ? {
                      selection: options[reflectionOption!],
                      optionIndex: reflectionOption,
                    }
                  : { text: reflectionDraft.trim() }
                await save("reflection", meta, true)
                if (content.saveToProfile && onSaveProfile && hasOptions) {
                  await onSaveProfile({
                    [String(content.profileKey ?? "favoriteApplication")]: options[reflectionOption!],
                  })
                }
              }}
            >
              {saving ? "Saving…" : "Save reflection"}
            </Button>
          )}
          {blockProgress?.reflection && (
            <p className="text-xs text-emerald-600">
              {content.saveToProfile ? "Saved to your profile and journal." : "Reflection saved to your journal."}
            </p>
          )}
        </CampModernSurface>
      )
    }

    case "activity": {
      const options = (content.options as string[]) ?? []
      const fields = (content.fields as string[]) ?? []
      const isPoll = content.activityType === "poll" || options.length > 0
      return (
        <CampModernSurface className="space-y-4">
          <div>
            <p
              className={cn(
                "text-lg font-bold",
                inPresentation ? "text-slate-900" : "text-slate-900 dark:text-white",
              )}
            >
              {String(content.title ?? "Activity")}
            </p>
            {content.prompt ? (
              <p
                className={cn(
                  "text-sm mt-1",
                  inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-400",
                )}
              >
                {String(content.prompt)}
              </p>
            ) : null}
          </div>
          {fields.length > 0 && (
            <ul
              className={cn(
                "text-sm space-y-1",
                inPresentation ? "text-slate-700" : "text-slate-600 dark:text-slate-400",
              )}
            >
              {fields.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 text-violet-500" />
                  {f}
                </li>
              ))}
            </ul>
          )}
          {isPoll && (
            <CampPollOptionGrid
              options={options}
              selected={activitySelection}
              multiSelect={Boolean(content.multiSelect)}
              disabled={readOnly || saving}
              onToggle={(idx) => {
                const selected = activitySelection.includes(idx)
                const nextSelection = content.multiSelect
                  ? selected
                    ? activitySelection.filter((i) => i !== idx)
                    : [...activitySelection, idx]
                  : [idx]
                setActivitySelection(nextSelection)
                if (!content.multiSelect && !readOnly && onSaveProgress && nextSelection.length > 0) {
                  void (async () => {
                    await save(
                      "engagement",
                      {
                        activityType: content.activityType,
                        selected: nextSelection,
                        labels: nextSelection.map((i) => options[i]),
                        revealed: true,
                      },
                      true,
                    )
                    if (content.revealMessage) setActivityRevealed(true)
                  })()
                }
              }}
            />
          )}
          {!readOnly && onSaveProgress && isPoll && content.multiSelect && activitySelection.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                void save(
                  "engagement",
                  {
                    activityType: content.activityType,
                    selected: activitySelection,
                    labels: activitySelection.map((i) => options[i]),
                    revealed: true,
                  },
                  true,
                )
                if (content.revealMessage) setActivityRevealed(true)
              }}
            >
              {saving ? "Saving…" : "Submit"}
            </Button>
          )}
          {!content.multiSelect &&
            (activityRevealed || blockProgress?.engagement?.revealed) &&
            !content.revealMessage &&
            !content.revealTitle && (
              <p className="text-xs text-emerald-600">Response saved.</p>
            )}
          {(activityRevealed || blockProgress?.engagement?.revealed) &&
            (content.revealMessage || content.revealTitle) && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm space-y-1",
                inPresentation
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
              )}
            >
              {content.revealTitle && (
                <p className="font-bold text-base">{String(content.revealTitle)}</p>
              )}
              {content.revealMessage && <p>{String(content.revealMessage)}</p>}
            </div>
          )}
          {content.activityType === "intro" && (
            <p className="text-xs text-slate-500">Share your introduction in the discussion thread below.</p>
          )}
          {content.activityType === "first_discussion" && (
            <p className="text-xs text-violet-600 dark:text-violet-400">
              🎉 Post below to earn your First Discussion Badge!
            </p>
          )}
        </CampModernSurface>
      )
    }

    case "feedback": {
      const kind = String(content.kind ?? "clarity")
      if (kind === "module_reflection") {
        return (
          <CampModuleReflectionBlock
            content={content}
            blockProgress={blockProgress}
            readOnly={readOnly}
            saving={saving}
            onOpenSupport={onOpenSupport}
            onScrollDiscussion={onScrollDiscussion}
            onSave={async (metadata) => {
              const prev = (blockProgress?.feedback ?? {}) as Record<string, unknown>
              await save("feedback", { ...prev, ...metadata, submitted: true }, true)
            }}
          />
        )
      }
      if (kind === "excitement") {
        return (
          <CampExcitementFeedbackBlock
            content={content}
            blockProgress={blockProgress}
            readOnly={readOnly}
            saving={saving}
            onOpenSupport={onOpenSupport}
            onSave={async (metadata) => {
              const prev = (blockProgress?.feedback ?? {}) as Record<string, unknown>
              await save("feedback", { ...prev, ...metadata, submitted: true }, true)
            }}
          />
        )
      }
      const saved = blockProgress?.feedback as Record<string, unknown> | undefined
      const savedRating = saved?.rating as number | undefined
      const savedYesNo = saved?.value as string | undefined
      return (
        <div
          className={cn(
            "rounded-xl border p-4 sm:p-5 space-y-3",
            inPresentation
              ? cn(CAMP_PRESENTATION_NESTED_PANEL, "border-slate-200")
              : "border-dashboard-v2-border bg-dashboard-v2-card",
          )}
        >
          <p
            className={cn(
              "text-sm font-medium",
              inPresentation ? "text-slate-800" : "text-slate-800 dark:text-slate-200",
            )}
          >
            {String(content.question ?? "How was this module?")}
          </p>
          {kind === "rating" ? (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={readOnly}
                  onClick={() => void save("feedback", { kind: "rating", rating: n }, true)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    savedRating === n ? "text-amber-500" : "text-slate-300 hover:text-amber-400",
                  )}
                  aria-label={`Rate ${n} stars`}
                >
                  <Star className={cn("h-6 w-6", savedRating != null && n <= savedRating && "fill-current")} />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              {["Yes", "No"].map((label) => (
                <Button
                  key={label}
                  size="sm"
                  variant={savedYesNo === label ? "default" : "outline"}
                  disabled={readOnly || saving}
                  onClick={() => void save("feedback", { kind: "clarity", value: label }, true)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )
    }

    case "interactive": {
      const variant = String(content.variant ?? "expand")
      if (variant === "start_journey") {
        return (
          <CampStartJourneyBlock
            revealed={journeyRevealed || Boolean(blockProgress?.engagement?.journeyRevealed)}
            onReveal={() => {
              setJourneyRevealed(true)
              void save("engagement", { journeyRevealed: true }, true)
            }}
            onContinue={onContinueModuleSections}
          />
        )
      }
      if (variant === "demo_flow") return <CampDemoFlowBlock />
      if (variant === "roadmap_map") return <CampRoadmapMapBlock />
      if (variant === "matching") return <CampMatchingPairsBlock content={content} />
      if (variant === "feature_cards") return <CampFeatureCardGridBlock content={content} />
      if (variant === "numbered_steps") return <CampNumberedStepsBlock content={content} />
      if (variant === "wave_cards") return <CampWaveCardsBlock content={content} />
      if (variant === "concept_cards") return <CampConceptCardsBlock content={content} />
      if (variant === "dual_model_compare") return <CampDualModelCompareBlock content={content} />
      if (variant === "ai_type_cards") return <CampAiTypeCardsBlock content={content} />
      if (variant === "industrial_compare") return <CampIndustrialCompareBlock content={content} />
      if (variant === "topic_deck") return <CampTopicDeckBlock content={content} />
      if (variant === "hands_on_missions") return <CampHandsOnMissionsBlock content={content} />
      if (variant === "prompt_workshop") return <CampPromptWorkshopBlock content={content} />
      if (variant === "flashcard_carousel") return <CampFlashcardCarouselBlock content={content} />
      if (variant === "myth_fact_carousel") return <CampMythFactCarouselBlock content={content} />
      if (variant === "example_cards") return <CampExampleCardsBlock content={content} />
      if (variant === "training_demo") return <CampTrainingPipelineBlock />
      if (variant === "programming_traditional")
        return <CampProgrammingFlowBlock content={{ ...content, mode: "traditional" }} />
      if (variant === "programming_ml")
        return <CampProgrammingFlowBlock content={{ ...content, mode: "ml" }} />
      if (variant === "ai_hierarchy") return <CampAiHierarchyBlock content={content} />
      if (variant === "comparison_table") return <CampComparisonTableBlock content={content} />
      if (variant === "industry_sectors") return <CampIndustrySectorsBlock content={content} />
      if (variant === "industry_spotlight") return <CampIndustrySpotlightBlock content={content} />
      if (variant === "pattern_gallery") return <CampPatternGalleryBlock content={content} />
      if (variant === "ml_compare") return <CampMlCompareBlock />
      if (variant === "vertical_pipeline") return <CampVerticalPipelineBlock content={content} />
      if (variant === "step_order") return <CampStepOrderBlock content={content} />
      if (variant === "training_loop") return <CampTrainingLoopBlock />
      if (variant === "training_simulation") return <CampTrainingSimulationBlock />
      if (variant === "prediction_flow") return <CampPredictionFlowBlock />
      if (variant === "prediction_challenge") return <CampPredictionChallengeBlock />
      if (variant === "brain_network") return <CampBrainNetworkBlock />
      if (variant === "dl_applications") return <CampDlApplicationsBlock content={content} />
      if (variant === "project_architecture") return <CampProjectArchitectureBlock content={content} />
      if (variant === "data_types_gallery") return <CampDataTypesGalleryBlock content={content} />
      if (variant === "mini_project")
        return (
          <CampMiniProjectBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "vision_observe") return <CampVisionObserveBlock content={content} />
      if (variant === "vision_pipeline_compare") return <CampVisionPipelineCompareBlock />
      if (variant === "pixel_zoom") return <CampPixelZoomBlock />
      if (variant === "rgb_tool") return <CampRgbToolBlock />
      if (variant === "dog_matrix") return <CampDogVsMatrixBlock />
      if (variant === "cv_feature_pipeline") return <CampCvFeaturePipelineBlock />
      if (variant === "cat_dog_compare") return <CampCatDogCompareBlock />
      if (variant === "cv_tasks") return <CampCvTasksBlock />
      if (variant === "bounding_box_demo") return <CampBoundingBoxDemoBlock />
      if (variant === "task_sort") return <CampTaskSortBlock content={content} />
      if (variant === "detection_scores") return <CampDetectionScoresBlock content={content} />
      if (variant === "detection_viewer") return <CampDetectionViewerBlock />
      if (variant === "od_use_cases") return <CampOdUseCasesBlock content={content} />
      if (variant === "human_vs_ai") return <CampHumanVsAiBlock />
      if (variant === "vision_design")
        return (
          <CampVisionDesignBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "segmentation_demo") return <CampSegmentationDemoBlock />
      if (variant === "iot_network_flow") return <CampIotNetworkFlowBlock />
      if (variant === "sensor_gallery") return <CampSensorGalleryBlock content={content} />
      if (variant === "sensor_match") return <CampSensorMatchBlock content={content} />
      if (variant === "connectivity_match") return <CampConnectivityMatchBlock />
      if (variant === "iot_components") return <CampIotComponentsBlock />
      if (variant === "iot_system_flow") return <CampIotSystemFlowBlock />
      if (variant === "data_explosion") return <CampDataExplosionBlock />
      if (variant === "edge_choice") return <CampEdgeChoiceBlock />
      if (variant === "iot_ai_pipeline") return <CampIotAiPipelineBlock />
      if (variant === "iot_ai_examples") return <CampIotAiExamplesBlock />
      if (variant === "iot_applications") return <CampIotApplicationsBlock content={content} />
      if (variant === "iot_system_builder")
        return (
          <CampIotSystemBuilderBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "cloud_flow") return <CampCloudFlowBlock />
      if (variant === "cloud_benefits") return <CampCloudBenefitsBlock />
      if (variant === "latency_workflow") return <CampLatencyWorkflowBlock />
      if (variant === "latency_demo") return <CampLatencyDemoBlock />
      if (variant === "cloud_vs_edge") return <CampCloudVsEdgeBlock />
      if (variant === "edge_benefits") return <CampEdgeBenefitsBlock />
      if (variant === "edge_benefit_match") return <CampEdgeBenefitMatchBlock />
      if (variant === "edge_applications") return <CampEdgeApplicationsBlock />
      if (variant === "edge_device_gallery") return <CampEdgeDeviceGalleryBlock />
      if (variant === "pi_hardware_preview") return <CampPiHardwarePreviewBlock />
      if (variant === "cloud_edge_sort") return <CampCloudEdgeSortBlock content={content} />
      if (variant === "edge_journey") return <CampEdgeJourneyBlock />
      if (variant === "smart_camera_poll") return <CampSmartCameraPollBlock />
      if (variant === "edge_ai_formula") return <CampEdgeAiFormulaBlock />
      if (variant === "intelligence_evolution") return <CampIntelligenceEvolutionBlock />
      if (variant === "edge_ai_architecture") return <CampEdgeAiArchitectureBlock />
      if (variant === "edge_ai_challenges") return <CampEdgeAiChallengesBlock />
      if (variant === "cloud_vs_pi") return <CampCloudVsPiBlock />
      if (variant === "capstone_pipeline") return <CampCapstonePipelineBlock />
      if (variant === "capstone_steps") return <CampCapstoneStepsBlock />
      if (variant === "tflite_compare") return <CampTfliteCompareBlock />
      if (variant === "edge_ai_design")
        return (
          <CampEdgeAiDesignBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "edge_ai_future") return <CampEdgeAiFutureBlock />
      if (variant === "pi_hero") return <CampPiHeroBlock content={content} />
      if (variant === "pi_ai_poll") return <CampPiAiPollBlock />
      if (variant === "desktop_vs_pi") return <CampDesktopVsPiBlock content={content} />
      if (variant === "pi_why_love") return <CampPiWhyLoveBlock />
      if (variant === "pi_hardware_explorer") return <CampPiHardwareExplorerBlock content={content} />
      if (variant === "pi_component_match") return <CampPiComponentMatchBlock />
      if (variant === "pi_edge_diagram") return <CampPiEdgeDiagramBlock />
      if (variant === "pi_real_world") return <CampPiRealWorldBlock />
      if (variant === "camera_module") return <CampCameraModuleBlock content={content} />
      if (variant === "camera_required_poll") return <CampCameraRequiredPollBlock />
      if (variant === "pi_ecosystem") return <CampPiEcosystemBlock content={content} />
      if (variant === "pi_setup_builder")
        return (
          <CampPiSetupBuilderBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "pi_safety") return <CampPiSafetyBlock />
      if (variant === "pi_project_walkthrough") return <CampPiProjectWalkthroughBlock />
      if (variant === "pi_mission_preview") return <CampPiMissionPreviewBlock />
      if (variant === "pi_setup_mission") return <CampPiSetupMissionBlock />
      if (variant === "hardware_inventory") return <CampHardwareInventoryBlock />
      if (variant === "hardware_kit_layout") return <CampHardwareKitLayoutBlock content={content} />
      if (variant === "boot_process") return <CampBootProcessBlock />
      if (variant === "pi_assembly_steps") return <CampPiAssemblyStepsBlock content={content} />
      if (variant === "camera_orientation") return <CampCameraOrientationBlock content={content} />
      if (variant === "os_install_tracker") return <CampOsInstallTrackerBlock />
      if (variant === "pi_imager_workflow") return <CampPiImagerWorkflowBlock content={content} />
      if (variant === "led_indicators") return <CampLedIndicatorsBlock />
      if (variant === "pi_config_tour") return <CampPiConfigTourBlock />
      if (variant === "desktop_tour") return <CampDesktopTourBlock content={content} />
      if (variant === "terminal_commands") return <CampTerminalCommandsBlock />
      if (variant === "camera_verify") return <CampCameraVerifyBlock content={content} />
      if (variant === "pi_troubleshooting") return <CampPiTroubleshootingBlock />
      if (variant === "mission_success") return <CampMissionSuccessBlock />
      if (variant === "tflite_mission") return <CampTfliteMissionBlock />
      if (variant === "giant_model_poll") return <CampGiantModelPollBlock />
      if (variant === "tflite_why") return <CampTfliteWhyBlock />
      if (variant === "training_vs_inference") return <CampTrainingVsInferenceBlock />
      if (variant === "inference_poll") return <CampInferencePollBlock />
      if (variant === "command_lesson") return <CampCommandLessonBlock content={content} />
      if (variant === "git_quiz") return <CampGitQuizBlock />
      if (variant === "folder_path") return <CampFolderPathBlock />
      if (variant === "setup_script") return <CampSetupScriptBlock />
      if (variant === "libatlas_insight") return <CampLibAtlasBlock />
      if (variant === "ai_model_visualizer") return <CampAiModelVisualizerBlock />
      if (variant === "verify_install") return <CampVerifyInstallBlock />
      if (variant === "first_ai_demo") return <CampFirstAiDemoBlock />
      if (variant === "tflite_troubleshooting") return <CampTfliteTroubleshootingBlock />
      if (variant === "ai_environment_status") return <CampAiEnvironmentStatusBlock />
      if (variant === "opencv_mission") return <CampOpencvMissionBlock />
      if (variant === "opencv_pixels_poll") return <CampOpencvPixelsPollBlock content={content} />
      if (variant === "cv_environment_status") return <CampCvEnvironmentStatusBlock />
      if (variant === "od_mission") return <CampOdMissionBlock />
      if (variant === "face_eye_mission") return <CampFaceEyeMissionBlock />
      if (variant === "face_detection_workflow") return <CampFaceDetectionWorkflowBlock />
      if (variant === "eye_detection_workflow") return <CampEyeDetectionWorkflowBlock />
      if (variant === "face_eye_engineer_poll") return <CampFaceEyeEngineerPollBlock />
      if (variant === "face_eye_pipeline") return <CampFaceEyePipelineBlock content={content} />
      if (variant === "face_eye_bounding_legend") return <CampFaceEyeBoundingLegendBlock />
      if (variant === "face_eye_sample_gallery") return <CampFaceEyeSampleGalleryBlock content={content} />
      if (variant === "face_eye_run_success") return <CampFaceEyeRunSuccessBlock />
      if (variant === "face_eye_investigation") return <CampFaceEyeInvestigationBlock />
      if (variant === "face_eye_troubleshooting") return <CampFaceEyeTroubleshootingBlock />
      if (variant === "face_eye_mission_accomplished") return <CampFaceEyeMissionAccomplishedBlock />
      if (variant === "opening_challenge") return <CampOpeningChallengeBlock />
      if (variant === "ai_accuracy_poll") return <CampAiAccuracyPollBlock />
      if (variant === "od_definition") return <CampOdDefinitionBlock />
      if (variant === "od_result_viz") return <CampOdResultVisualizationBlock content={content} />
      if (variant === "manual_bounding_box") return <CampManualBoundingBoxBlock content={content} />
      if (variant === "confidence_compare") return <CampConfidenceCompareBlock />
      if (variant === "confidence_visual") return <CampConfidenceVisualBlock />
      if (variant === "model_class_gallery") return <CampModelClassGalleryBlock />
      if (variant === "run_detection") return <CampRunDetectionBlock content={content} />
      if (variant === "detection_data_table") return <CampDetectionDataTableBlock />
      if (variant === "confuse_ai") return <CampConfuseAiBlock />
      if (variant === "od_pipeline_anim") return <CampOdPipelineAnimBlock content={content} />
      if (variant === "od_journey") return <CampOdJourneyBlock />
      if (variant === "od_investigation") return <CampOdInvestigationBlock />
      if (variant === "od_design_challenge")
        return (
          <CampOdDesignChallengeBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "od_security_design")
        return (
          <CampOdSecurityDesignBlock
            content={content}
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "mission_accomplished") return <CampMissionAccomplishedBlock />
      if (variant === "showcase_journey") return <CampShowcaseJourneyBlock />
      if (variant === "showcase_objectives") return <CampShowcaseObjectivesBlock />
      if (variant === "video_demo_guide") return <CampVideoDemoGuideBlock />
      if (variant === "screenshot_guide") return <CampScreenshotGuideBlock />
      if (variant === "reflection_report_guide")
        return (
          <CampReflectionReportGuideBlock
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "showcase_rubric") return <CampShowcaseRubricBlock />
      if (variant === "achievement_summary") return <CampAchievementSummaryBlock content={content} />
      if (variant === "certificate_requirements") return <CampCertificateRequirementsBlock content={content} />
      if (variant === "certificate_award") return <CampCertificateAwardBlock content={content} />
      if (variant === "final_survey")
        return (
          <CampFinalSurveyBlock
            camperProfile={camperProfile}
            onSaveProfile={onSaveProfile}
            readOnly={readOnly}
          />
        )
      if (variant === "graduation") return <CampGraduationBlock content={content} />
      const items = (content.items as Array<{ id: string; label: string; detail: string }>) ?? []
      return (
        <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
          <p className="font-semibold text-slate-900 dark:text-white">{String(content.title ?? "Explore")}</p>
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setExpandedInteractive(expandedInteractive === item.id ? null : item.id)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                  expandedInteractive === item.id
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-400",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-slate-400 transition-transform",
                      expandedInteractive === item.id && "rotate-90",
                    )}
                  />
                </div>
                {expandedInteractive === item.id && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{item.detail}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case "confidence": {
      const saved = (blockProgress?.confidence?.level as number) ?? null
      return (
        <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 sm:p-5 space-y-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {String(content.question ?? "How confident are you in this topic?")}
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                disabled={readOnly || saving}
                onClick={() => void save("confidence", { level }, true)}
                className={cn(
                  "size-10 rounded-lg border font-semibold text-sm transition-colors",
                  saved === level
                    ? "border-violet-500 bg-violet-500 text-white"
                    : "border-slate-200 dark:border-slate-700 hover:border-violet-400 text-slate-700 dark:text-slate-300",
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">1 = lost · 5 = expert</p>
        </div>
      )
    }

    case "video": {
      const rawUrl = String(content.url ?? "")
      const embedUrl = toVideoEmbedUrl(rawUrl)
      const watchUrl = toYouTubeWatchUrl(rawUrl) ?? toYouTubeWatchUrl(embedUrl)
      return (
        <div className="space-y-3">
          {content.title && (
            <p className="font-semibold text-slate-900 dark:text-white">{String(content.title)}</p>
          )}
          <div className="rounded-xl border border-dashboard-v2-border overflow-hidden aspect-video bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={String(content.title ?? "Video")}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">Video embed</div>
            )}
          </div>
          {watchUrl && (
            <p className="text-xs text-slate-500">
              Prefer to watch on YouTube?{" "}
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 dark:text-violet-400 hover:underline"
              >
                Open this clip in a new tab
              </a>
            </p>
          )}
        </div>
      )
    }

    case "pdf":
      return (
        <div className="rounded-xl border border-dashboard-v2-border overflow-hidden min-h-[240px] h-[min(480px,65vh)] sm:h-[480px]">
          {content.url ? (
            <iframe src={String(content.url)} className="w-full h-full" title="PDF viewer" />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">PDF viewer</div>
          )}
        </div>
      )

    case "image_gallery": {
      const cards = (content.cards as Array<{ title: string; description?: string }>) ?? []
      if (cards.length > 0) return <CampExampleCardsBlock content={content} />
      const images = (content.images as string[]) ?? []
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((src, i) => (
            <CampScaledImage
              key={i}
              src={src}
              aspectClass="aspect-square"
              className="rounded-lg border border-dashboard-v2-border"
            />
          ))}
        </div>
      )
    }

    case "hero":
      return <CampHeroBlock content={content} />

    case "faculty_cards":
      return <CampFacultyCardsBlock content={content} />

    case "mission_objectives":
      return <CampMissionObjectivesBlock content={content} />

    case "profile_form":
      return (
        <CampProfileFormBlock
          content={content}
          camperProfile={camperProfile}
          onSaveProfile={
            onSaveProfile
              ? async (patch) => {
                  await onSaveProfile(patch)
                  if (onMarkSectionComplete) await onMarkSectionComplete(block.id)
                }
              : undefined
          }
          readOnly={readOnly}
        />
      )

    case "module_completion":
      return (
        <CampModuleCompletionBlock
          content={content}
          isModuleComplete={isModuleComplete}
          rewards={moduleRewards}
          knowledgeCheckGaps={knowledgeCheckGaps}
        />
      )

    default:
      return null
  }
}

export function CampDiscussionPanel({
  discussions,
  onSubmit,
  loading,
}: {
  discussions: Array<{
    id: number
    title: string | null
    body: string
    status: string
    replies?: Array<{ body: string; author_name?: string; author_type?: string }>
  }>
  onSubmit: (body: string, parentId?: number) => void
  loading?: boolean
}) {
  const [message, setMessage] = useState("")

  return (
    <div className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-violet-500" />
        Discussion
      </h3>
      {discussions.length === 0 ? (
        <p className="text-sm text-slate-500">No questions yet. Ask your instructor below.</p>
      ) : (
        discussions.map((d) => (
          <div key={d.id} className="space-y-2 border-b border-dashboard-v2-border pb-3 last:border-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{d.status}</Badge>
              {d.title && <span className="text-sm font-medium">{d.title}</span>}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{d.body}</p>
            {d.replies?.map((r, i) => (
              <div key={i} className="ml-4 pl-3 border-l-2 border-violet-500/30 text-sm">
                <span className="font-medium text-violet-600 dark:text-violet-400">
                  {r.author_name ?? (r.author_type === "instructor" ? "Instructor" : "You")}
                </span>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">{r.body}</p>
              </div>
            ))}
          </div>
        ))
      )}
      <div className="space-y-2 pt-1">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask a question or share code…"
          rows={3}
          className="resize-none w-full min-h-[88px]"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!message.trim() || loading}
            onClick={() => {
              onSubmit(message)
              setMessage("")
            }}
          >
            {loading ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}
