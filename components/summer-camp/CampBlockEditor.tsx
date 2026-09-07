"use client"

import { useRef, useState, useCallback } from "react"
import { Plus, Trash2, GripVertical, Pencil, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CAMP_BLOCK_TYPES, type CampBlockType, type CampModuleBlock } from "@/lib/summer-camp/types"
import { CampBlockRenderer } from "@/components/summer-camp/CampBlockRenderer"
import { CampRichMarkdown } from "@/components/summer-camp/CampRichMarkdown"
import {
  CampImageUploadField,
  CampMarkdownToolbar,
  CAMP_CONTENT_BLOCK_TYPES,
  CAMP_CONTENT_BLOCK_LABELS,
  CAMP_CONTENT_TEMPLATES,
} from "@/components/summer-camp/camp-content-editor-tools"
import { CampInteractiveBlockEditor } from "@/components/summer-camp/camp-interactive-block-editor"
import { CampColumnGridBlock } from "@/components/summer-camp/camp-column-grid-block"
import { defaultColumnGridContent } from "@/lib/summer-camp/column-grid"
import {
  defaultTextBlockContent,
  defaultTextImageSideLayout,
  parseTextBlockSideLayout,
  type TextBlockSideLayout,
} from "@/lib/summer-camp/text-block-layout"
import { normalizeImageTransform } from "@/lib/summer-camp/image-layout"
import { normalizeBlockContent } from "@/lib/summer-camp/block-content"
import { hasInteractiveMediaEditor } from "@/lib/summer-camp/interactive-media-items"

const BLOCK_LABELS: Record<CampBlockType, string> = {
  text: "Text / Markdown",
  image: "Image",
  code: "Code snippet",
  image_gallery: "Image gallery",
  pdf: "PDF embed",
  video: "Video embed",
  step: "Step (checkable)",
  checkpoint: "Checkpoint (upload)",
  quiz: "Quiz / Knowledge Check",
  callout: "Callout / tip",
  reflection: "Reflection journal",
  activity: "Interactive activity",
  feedback: "Feedback / rating",
  interactive: "Interactive explorer",
  confidence: "Confidence check (1–5)",
  hero: "Hero banner",
  faculty_cards: "Faculty / TA cards",
  mission_objectives: "Mission objectives (XP)",
  profile_form: "Profile / icebreaker form",
  module_completion: "Module completion celebration",
  column_grid: "Grid layout (rows × columns)",
}

function defaultContent(type: CampBlockType): Record<string, unknown> {
  switch (type) {
    case "text":
      return defaultTextBlockContent()
    case "image":
      return { imageUrl: "", caption: "", alt: "Setup photo", ...normalizeImageTransform({ placement: "free" }) }
    case "code":
      return { language: "python", code: "# Your code here" }
    case "step":
      return { title: "New step", description: "Describe what the camper should do.", checkable: true }
    case "checkpoint":
      return {
        title: "Checkpoint",
        description: "Upload proof of completion.",
        acceptedTypes: ["image/png", "image/jpeg"],
        maxSizeMb: 5,
        referenceImageUrl: "",
        referenceLabel: "Camp demo",
        studentLabel: "Your upload",
        referencePlaceholder: "Reference screenshot",
      }
    case "callout":
      return {
        variant: "tip",
        text: "💡 Helpful tip: Add guidance that helps campers complete this step.",
      }
    case "quiz":
      return {
        title: "Quick check",
        questions: [
          {
            id: "q1",
            prompt: "Question?",
            options: ["Option A", "Option B", "Option C"],
            correctIndex: 0,
          },
        ],
      }
    case "video":
      return { url: "", title: "Video" }
    case "pdf":
      return { url: "" }
    case "image_gallery":
      return { cards: [{ title: "Setup step", description: "Describe this photo" }] }
    case "reflection":
      return { prompt: "What did you learn from this module?" }
    case "activity":
      return { title: "Activity", prompt: "Complete this activity.", activityType: "poll", options: [], multiSelect: true }
    case "feedback":
      return { question: "Was this module clear?", kind: "clarity" }
    case "interactive":
      return { variant: "start_journey", title: "Start My Journey" }
    case "confidence":
      return { question: "How confident are you in this topic? (1 = lost, 5 = expert)" }
    case "hero":
      return { title: "Camp Title", subtitle: "Tagline" }
    case "faculty_cards":
      return { faculty: [{ name: "Dr. Name", role: "Director", interests: "", funFact: "" }], assistants: [] }
    case "mission_objectives":
      return { missions: [{ title: "Mission title", xp: 25 }] }
    case "profile_form":
      return { title: "Profile form", fields: [{ key: "name", label: "Name" }] }
    case "module_completion":
      return { title: "Congratulations!", message: "Module complete." }
    case "column_grid":
      return defaultColumnGridContent() as unknown as Record<string, unknown>
    default:
      return {}
  }
}

function CampImageBlockEditorFields({
  value,
  onChange,
  trainingId,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  trainingId: number
}) {
  return (
    <div className="space-y-3">
      <CampImageUploadField
        trainingId={trainingId}
        label="Photo"
        hint="Upload a setup screenshot or hardware photo. Drag to position in the camper preview below."
        value={String(value.imageUrl ?? "")}
        onChange={(url) => onChange({ ...value, imageUrl: url })}
      />
      <Input
        value={String(value.caption ?? "")}
        onChange={(e) => onChange({ ...value, caption: e.target.value })}
        placeholder="Caption (optional)"
      />
      <Input
        value={String(value.alt ?? "")}
        onChange={(e) => onChange({ ...value, alt: e.target.value })}
        placeholder="Alt text for accessibility"
      />
    </div>
  )
}

function CampBlockEditorFields({
  type,
  value,
  onChange,
  trainingId,
}: {
  type: CampBlockType
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
  trainingId: number
}) {
  const textRef = useRef<HTMLTextAreaElement>(null)

  switch (type) {
    case "text":
      if (value.variant === "welcome_intro") {
        return (
          <p className="text-sm text-slate-500 rounded-lg border border-dashed p-3">
            This block uses the structured Welcome layout. Preview below shows the live camper view.
          </p>
        )
      }
      {
        const layout = parseTextBlockSideLayout(value)
        const sideLayout: TextBlockSideLayout = layout ?? defaultTextImageSideLayout()
        const hasImageCol = layout?.mode === "text_image"

        const setLayout = (patch: Partial<TextBlockSideLayout>) => {
          onChange({
            ...value,
            layout: { ...sideLayout, ...patch, image: { ...sideLayout.image, ...patch.image } },
          })
        }

        return (
          <div className="space-y-4">
            <CampMarkdownToolbar
              textareaRef={textRef}
              value={String(value.markdown ?? "")}
              onChange={(markdown) => onChange({ ...value, markdown })}
              trainingId={trainingId}
            />
            <Textarea
              ref={textRef}
              rows={10}
              value={String(value.markdown ?? "")}
              onChange={(e) => onChange({ ...value, markdown: e.target.value })}
              className="font-mono text-sm"
              placeholder="Use ### for subsections. Text appears in the left column when image layout is enabled."
            />

            <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-violet-800 dark:text-violet-200">
                  Image on slide
                </p>
                <div className="flex gap-2">
                  {!hasImageCol ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onChange({ ...value, layout: defaultTextImageSideLayout() })}
                    >
                      Add image
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-600"
                      onClick={() => onChange({ ...value, layout: { mode: "single" } })}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              </div>

              {hasImageCol ? (
                <>
                  <CampImageUploadField
                    trainingId={trainingId}
                    label="Side image"
                    hint="Upload a visual for the right column. Leave empty to show a placeholder until you add one."
                    value={String(sideLayout.image?.imageUrl ?? "")}
                    onChange={(url) => setLayout({ image: { ...sideLayout.image, imageUrl: url } })}
                  />
                  <Input
                    value={String(sideLayout.image?.caption ?? "")}
                    onChange={(e) => setLayout({ image: { ...sideLayout.image, caption: e.target.value } })}
                    placeholder="Caption"
                  />
                  <Input
                    value={String(sideLayout.image?.alt ?? "")}
                    onChange={(e) => setLayout({ image: { ...sideLayout.image, alt: e.target.value } })}
                    placeholder="Alt text"
                  />
                  <p className="text-[10px] text-slate-500">
                    Drag and resize the image in the camper preview below.
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500">Single-column text only. Add an image to place it on the slide.</p>
              )}
            </div>
          </div>
        )
      }
    case "image":
      return <CampImageBlockEditorFields value={value} onChange={onChange} trainingId={trainingId} />
    case "code":
      return (
        <div className="space-y-2">
          <Input
            value={String(value.language ?? "")}
            onChange={(e) => onChange({ ...value, language: e.target.value })}
            placeholder="Language"
          />
          <Textarea
            rows={6}
            value={String(value.code ?? "")}
            onChange={(e) => onChange({ ...value, code: e.target.value })}
            className="font-mono text-sm"
          />
        </div>
      )
    case "step":
      return (
        <div className="space-y-2">
          <Input
            value={String(value.title ?? "")}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Step title"
          />
          <Textarea
            value={String(value.description ?? "")}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            placeholder="Instructions"
          />
        </div>
      )
    case "checkpoint":
      return (
        <div className="space-y-3">
          <Input
            value={String(value.title ?? "")}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Checkpoint title"
          />
          <Textarea
            value={String(value.description ?? "")}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            placeholder="What should campers submit?"
          />
          <CampImageUploadField
            trainingId={trainingId}
            label="Reference screenshot (camp demo)"
            hint="Students see this beside their upload so they can compare installation output."
            value={String(value.referenceImageUrl ?? "")}
            onChange={(url) => onChange({ ...value, referenceImageUrl: url })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={String(value.referenceLabel ?? "Camp demo")}
              onChange={(e) => onChange({ ...value, referenceLabel: e.target.value })}
              placeholder="Reference label"
            />
            <Input
              value={String(value.studentLabel ?? "Your upload")}
              onChange={(e) => onChange({ ...value, studentLabel: e.target.value })}
              placeholder="Student upload label"
            />
          </div>
          <Input
            value={String(value.referencePlaceholder ?? "")}
            onChange={(e) => onChange({ ...value, referencePlaceholder: e.target.value })}
            placeholder="Placeholder text when reference image is empty"
          />
        </div>
      )
    case "callout":
      return (
        <div className="space-y-2">
          <Select
            value={String(value.variant ?? "tip")}
            onValueChange={(v) => onChange({ ...value, variant: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tip">Tip (green)</SelectItem>
              <SelectItem value="warning">Warning (amber)</SelectItem>
              <SelectItem value="info">Info (violet)</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={String(value.text ?? "")}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder="Tip or note for campers"
          />
          {String(value.text ?? "").trim() ? (
            <div className="rounded-lg border border-slate-200/80 p-3 bg-slate-50/50 dark:bg-white/[0.02]">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-2">Preview</p>
              <CampBlockRenderer
                block={{
                  id: -1,
                  module_id: 0,
                  block_type: "callout",
                  content: value,
                  sort_order: 0,
                  created_at: "",
                  updated_at: "",
                }}
                readOnly
              />
            </div>
          ) : null}
        </div>
      )
    case "video":
    case "pdf":
      return (
        <Input
          value={String(value.url ?? "")}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          placeholder="URL (YouTube embed or /uploads/...)"
        />
      )
    case "hero":
      return (
        <div className="space-y-3">
          <Input
            value={String(value.title ?? "")}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Hero title"
          />
          <Input
            value={String(value.subtitle ?? "")}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
            placeholder="Subtitle"
          />
          <CampImageUploadField
            trainingId={trainingId}
            label="Background image"
            value={String(value.imageUrl ?? "")}
            onChange={(url) => onChange({ ...value, imageUrl: url })}
          />
        </div>
      )
    case "image_gallery": {
      const cards = (value.cards as Array<Record<string, string>>) ?? []
      const images = (value.images as string[]) ?? []
      if (cards.length > 0 || !images.length) {
        return (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Gallery cards — upload a photo for each step.</p>
            {cards.map((card, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-slate-50/50 dark:bg-white/[0.02]">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500">Card {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 h-7"
                    onClick={() => {
                      const next = cards.filter((_, j) => j !== i)
                      onChange({ ...value, cards: next })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={card.title ?? ""}
                  onChange={(e) => {
                    const next = [...cards]
                    next[i] = { ...next[i], title: e.target.value }
                    onChange({ ...value, cards: next })
                  }}
                  placeholder="Title"
                />
                <Input
                  value={card.description ?? ""}
                  onChange={(e) => {
                    const next = [...cards]
                    next[i] = { ...next[i], description: e.target.value }
                    onChange({ ...value, cards: next })
                  }}
                  placeholder="Description"
                />
                <CampImageUploadField
                  trainingId={trainingId}
                  label="Card image"
                  value={String(card.imageUrl ?? "")}
                  onChange={(url) => {
                    const next = [...cards]
                    next[i] = { ...next[i], imageUrl: url }
                    onChange({ ...value, cards: next })
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  cards: [...cards, { title: "New photo", description: "" }],
                })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Add card
            </Button>
          </div>
        )
      }
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Image URLs (one per line)</p>
          <Textarea
            rows={4}
            value={images.join("\n")}
            onChange={(e) =>
              onChange({
                ...value,
                images: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      )
    }
    case "faculty_cards": {
      const faculty = (value.faculty as Array<Record<string, string>>) ?? []
      const assistants = (value.assistants as Array<Record<string, string>>) ?? []
      const renderPeople = (
        people: Array<Record<string, string>>,
        key: "faculty" | "assistants",
        label: string,
      ) => (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">{label}</p>
          {people.map((person, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {label.replace(/s$/, "")} {i + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-500"
                  onClick={() => onChange({ ...value, [key]: people.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={person.name ?? ""}
                onChange={(e) => {
                  const next = [...people]
                  next[i] = { ...next[i], name: e.target.value }
                  onChange({ ...value, [key]: next })
                }}
                placeholder="Name"
              />
              <Input
                value={person.role ?? ""}
                onChange={(e) => {
                  const next = [...people]
                  next[i] = { ...next[i], role: e.target.value }
                  onChange({ ...value, [key]: next })
                }}
                placeholder="Role"
              />
              {key === "faculty" && (
                <Input
                  value={person.interests ?? ""}
                  onChange={(e) => {
                    const next = [...people]
                    next[i] = { ...next[i], interests: e.target.value }
                    onChange({ ...value, [key]: next })
                  }}
                  placeholder="Research interests"
                />
              )}
              <Input
                value={person.funFact ?? ""}
                onChange={(e) => {
                  const next = [...people]
                  next[i] = { ...next[i], funFact: e.target.value }
                  onChange({ ...value, [key]: next })
                }}
                placeholder="Fun fact"
              />
              <CampImageUploadField
                trainingId={trainingId}
                label="Photo"
                value={String(person.photoUrl ?? "")}
                onChange={(url) => {
                  const next = [...people]
                  next[i] = { ...next[i], photoUrl: url }
                  onChange({ ...value, [key]: next })
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                [key]: [...people, { name: "", role: "", funFact: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add {label.toLowerCase().replace(/s$/, "")}
          </Button>
        </div>
      )
      return (
        <div className="space-y-4">
          {renderPeople(faculty, "faculty", "Faculty")}
          {renderPeople(assistants, "assistants", "Teaching assistants")}
        </div>
      )
    }
    case "interactive": {
      const variant = String(value.variant ?? "")
      const hasMediaEditor = hasInteractiveMediaEditor(variant)
      return (
        <div className="space-y-3">
          <Input
            value={variant}
            onChange={(e) => onChange({ ...value, variant: e.target.value })}
            placeholder="Variant key (e.g. pi_imager_workflow)"
            disabled={hasMediaEditor}
            className={hasMediaEditor ? "opacity-60" : undefined}
          />
          {!hasMediaEditor ? (
            <Input
              value={String(value.title ?? "")}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              placeholder="Display title (optional)"
            />
          ) : null}
          <CampInteractiveBlockEditor value={value} onChange={onChange} trainingId={trainingId} />
        </div>
      )
    }
    case "quiz": {
      const questions = (value.questions as Array<Record<string, unknown>>) ?? []
      return (
        <div className="space-y-3">
          <Input
            value={String(value.title ?? "")}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Quiz title"
          />
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Question {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-500"
                  onClick={() =>
                    onChange({ ...value, questions: questions.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Textarea
                value={String(q.prompt ?? "")}
                onChange={(e) => {
                  const next = [...questions]
                  next[i] = { ...next[i], prompt: e.target.value }
                  onChange({ ...value, questions: next })
                }}
                placeholder="Question prompt"
                rows={2}
              />
              {((q.options as string[]) ?? []).map((opt, oi) => (
                <Input
                  key={oi}
                  value={opt}
                  onChange={(e) => {
                    const next = [...questions]
                    const opts = [...((next[i].options as string[]) ?? [])]
                    opts[oi] = e.target.value
                    next[i] = { ...next[i], options: opts }
                    onChange({ ...value, questions: next })
                  }}
                  placeholder={`Option ${oi + 1}`}
                />
              ))}
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const next = [...questions]
                    const opts = [...((next[i].options as string[]) ?? []), `Option ${((next[i].options as string[]) ?? []).length + 1}`]
                    next[i] = { ...next[i], options: opts }
                    onChange({ ...value, questions: next })
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add option
                </Button>
                <label className="text-xs text-slate-500 flex items-center gap-1">
                  Correct index
                  <Input
                    type="number"
                    min={0}
                    className="w-20 h-8"
                    value={Number(q.correctIndex ?? 0)}
                    onChange={(e) => {
                      const next = [...questions]
                      next[i] = { ...next[i], correctIndex: Number(e.target.value) }
                      onChange({ ...value, questions: next })
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                questions: [
                  ...questions,
                  {
                    id: `q${questions.length + 1}`,
                    prompt: "New question?",
                    options: ["Option A", "Option B"],
                    correctIndex: 0,
                  },
                ],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add question
          </Button>
        </div>
      )
    }
    case "mission_objectives": {
      const missions = (value.missions as Array<Record<string, unknown>>) ?? []
      return (
        <div className="space-y-3">
          {missions.map((m, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Mission {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-500"
                  onClick={() => onChange({ ...value, missions: missions.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                value={String(m.title ?? "")}
                onChange={(e) => {
                  const next = [...missions]
                  next[i] = { ...next[i], title: e.target.value }
                  onChange({ ...value, missions: next })
                }}
                placeholder="Mission title"
              />
              <Input
                type="number"
                value={Number(m.xp ?? 0)}
                onChange={(e) => {
                  const next = [...missions]
                  next[i] = { ...next[i], xp: Number(e.target.value) }
                  onChange({ ...value, missions: next })
                }}
                placeholder="XP"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                missions: [...missions, { title: "New mission", xp: 25 }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add mission
          </Button>
        </div>
      )
    }
    case "activity": {
      const options = (value.options as string[]) ?? []
      return (
        <div className="space-y-3">
          <Input
            value={String(value.title ?? "")}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Activity title"
          />
          <Textarea
            value={String(value.prompt ?? "")}
            onChange={(e) => onChange({ ...value, prompt: e.target.value })}
            placeholder="Activity prompt"
          />
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = e.target.value
                  onChange({ ...value, options: next })
                }}
                placeholder={`Choice ${i + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500"
                onClick={() => onChange({ ...value, options: options.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...value, options: [...options, "New choice"] })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add choice
          </Button>
        </div>
      )
    }
    case "reflection":
      return (
        <div className="space-y-2">
          <Textarea
            value={String(value.prompt ?? "")}
            onChange={(e) => onChange({ ...value, prompt: e.target.value })}
            placeholder="Reflection prompt"
          />
          <Input
            value={String(value.profileKey ?? "")}
            onChange={(e) => onChange({ ...value, profileKey: e.target.value })}
            placeholder="Profile key (optional)"
          />
        </div>
      )
    case "column_grid":
      return (
        <CampColumnGridBlock
          content={value}
          readOnly={false}
          trainingId={trainingId}
          onChange={(next) => onChange(next as unknown as Record<string, unknown>)}
        />
      )
    default:
      return (
        <Textarea
          rows={4}
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value) as Record<string, unknown>)
            } catch {
              /* ignore invalid JSON while typing */
            }
          }}
          className="font-mono text-xs"
        />
      )
  }
}

interface CampBlockEditorProps {
  blocks: CampModuleBlock[]
  trainingId: number
  onAdd: (type: CampBlockType, content: Record<string, unknown>, sortOrder: number) => Promise<void>
  onUpdate: (blockId: number, content: Record<string, unknown>) => Promise<void>
  onDelete: (blockId: number) => Promise<void>
  onMove?: (blockId: number, direction: -1 | 1) => Promise<void>
}

function blockSupportsLayoutPreview(type: CampBlockType): boolean {
  return type === "text" || type === "image" || type === "column_grid"
}

export function CampBlockEditor({ blocks, trainingId, onAdd, onUpdate, onDelete, onMove }: CampBlockEditorProps) {
  const [newType, setNewType] = useState<CampBlockType>("text")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [layoutSavingId, setLayoutSavingId] = useState<number | null>(null)
  const [layoutError, setLayoutError] = useState<{ blockId: number; message: string } | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)
  const layoutSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startEdit = (block: CampModuleBlock) => {
    setEditingId(block.id)
    setDraft(normalizeBlockContent(block.content))
    setLayoutError(null)
  }

  const persistLayout = useCallback(
    async (blockId: number, content: Record<string, unknown>) => {
      setLayoutSavingId(blockId)
      setLayoutError(null)
      try {
        await onUpdate(blockId, content)
        if (editingId === blockId) {
          setDraft(content)
        }
      } catch (err) {
        setLayoutError({
          blockId,
          message: err instanceof Error ? err.message : "Could not save layout",
        })
      } finally {
        setLayoutSavingId(null)
      }
    },
    [onUpdate, editingId],
  )

  const handleLayoutChange = useCallback(
    (blockId: number, next: Record<string, unknown>) => {
      if (editingId === blockId) {
        setDraft(next)
      }
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current)
      layoutSaveTimer.current = setTimeout(() => {
        void persistLayout(blockId, next)
      }, 120)
    },
    [editingId, persistLayout],
  )

  const saveEdit = async () => {
    if (editingId == null) return
    setSaving(true)
    try {
      await onUpdate(editingId, draft)
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const quickAdd = async (type: CampBlockType) => {
    await onAdd(type, defaultContent(type), blocks.length)
  }

  const quickAddTemplate = async (templateId: string) => {
    const template = CAMP_CONTENT_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    await onAdd(template.type as CampBlockType, { ...template.content }, blocks.length)
  }

  const moveBlock = async (blockId: number, direction: -1 | 1) => {
    if (!onMove) return
    setMovingId(blockId)
    try {
      await onMove(blockId, direction)
    } finally {
      setMovingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Quick add content</p>
        <p className="text-xs text-slate-500">
          Add text, photos, or galleries anywhere in the module. Use <strong>templates</strong> for
          headings, bullets, and callouts that match the rest of the camp. Move blocks with the arrows
          to place photos next to setup steps.
        </p>
        <div className="flex flex-wrap gap-2">
          {CAMP_CONTENT_BLOCK_TYPES.map((type) => (
            <Button key={type} type="button" variant="outline" size="sm" onClick={() => void quickAdd(type)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {CAMP_CONTENT_BLOCK_LABELS[type] ?? type}
            </Button>
          ))}
        </div>
        <div className="pt-1 border-t border-violet-500/20 space-y-2">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Curriculum templates</p>
          <div className="flex flex-wrap gap-2">
            {CAMP_CONTENT_TEMPLATES.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs"
                title={template.hint}
                onClick={() => void quickAddTemplate(template.id)}
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {blocks.map((block, index) => (
        <div
          key={block.id}
          className="rounded-xl border border-dashboard-v2-border bg-white/50 dark:bg-white/[0.02] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-dashboard-v2-border bg-slate-50 dark:bg-slate-900/50">
            <GripVertical className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">
              {BLOCK_LABELS[block.block_type]}
            </span>
            <div className="ml-auto flex gap-1 shrink-0">
              {onMove ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={index === 0 || movingId === block.id}
                    onClick={() => void moveBlock(block.id, -1)}
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={index === blocks.length - 1 || movingId === block.id}
                    onClick={() => void moveBlock(block.id, 1)}
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => startEdit(block)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500"
                onClick={() => void onDelete(block.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {editingId === block.id ? (
              <>
                <CampBlockEditorFields
                  type={block.block_type}
                  value={draft}
                  onChange={setDraft}
                  trainingId={trainingId}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void saveEdit()} disabled={saving}>
                    {saving ? "Saving…" : "Save block"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null)
                      setLayoutError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : null}

            <div className="relative rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/40 dark:bg-slate-900/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {blockSupportsLayoutPreview(block.block_type)
                    ? "Camper view — drag images to move, corners to resize (auto-saves)"
                    : "Camper view"}
                </p>
                {layoutSavingId === block.id ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-violet-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving layout…
                  </span>
                ) : null}
              </div>
              {layoutError?.blockId === block.id ? (
                <p className="text-xs text-red-600 mb-2">{layoutError.message}</p>
              ) : null}
              <CampBlockRenderer
                block={{
                  ...block,
                  content:
                    editingId === block.id
                      ? draft
                      : normalizeBlockContent(block.content),
                }}
                readOnly
                layoutEditable={blockSupportsLayoutPreview(block.block_type)}
                onContentChange={
                  blockSupportsLayoutPreview(block.block_type)
                    ? (next) => handleLayoutChange(block.id, next)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-dashed border-violet-500/40 p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-slate-500 mb-1 block">Add advanced block</label>
          <Select value={newType} onValueChange={(v) => setNewType(v as CampBlockType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CAMP_BLOCK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{BLOCK_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void onAdd(newType, defaultContent(newType), blocks.length)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add block
        </Button>
      </div>
    </div>
  )
}
