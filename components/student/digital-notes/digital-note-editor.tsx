"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useEditor, EditorContent, useEditorState, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import HorizontalRule from "@tiptap/extension-horizontal-rule"
import Image from "@tiptap/extension-image"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  PenLine,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { cn } from "@/lib/utils"
import {
  isMarkdownNoteContent,
  markdownToNoteHtml,
  noteBodyForEditor,
  noteBodyForSave,
  prepareNoteContentForEditor,
} from "@/lib/digital-note-content"
import { toast } from "@/lib/app-toast"
import "./digital-note-editor.css"

const MAX_EMBED_BYTES = 1_400_000

type DigitalNoteEditorProps = {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Changes when switching notes — avoids resetting the editor on every keystroke. */
  noteKey?: string | number | null
  /** Always use the rich TipTap toolbar (converts leftover markdown on first paint). */
  preferRich?: boolean
  /** Open markdown notes in preview instead of raw source. */
  defaultShowPreview?: boolean
}

function runEditorCommand(editor: Editor, command: () => boolean) {
  command()
}

function noteEditorShellClass(disabled: boolean, className?: string, mutedDisabled = false) {
  return cn(
    "digital-note-editor flex h-full flex-col overflow-hidden",
    isDesktopAppShell()
      ? "min-h-0 rounded-none border-0 bg-transparent"
      : "min-h-[320px] rounded-xl border border-[var(--border)] bg-[var(--card)]",
    disabled && (mutedDisabled ? "opacity-60" : "opacity-90"),
    className,
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => onClick()}
          className={cn(
            "h-8 w-8 shrink-0 rounded-md",
            active && "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)] hover:text-white",
          )}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

async function readImageAsDataUrl(file: File): Promise<string> {
  if (file.size > MAX_EMBED_BYTES) {
    throw new Error("That photo is too large to embed. Try a smaller image or crop it first.")
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (!result.startsWith("data:")) {
        reject(new Error("Could not read the selected photo."))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error("Could not read the selected photo."))
    reader.readAsDataURL(file)
  })
}

function MarkdownNotePreview({ markdown }: { markdown: string }) {
  return (
    <div
      className={cn(
        "digital-note-markdown-body prose prose-slate dark:prose-invert max-w-none",
        isDesktopAppShell() ? "px-0 pt-0 pb-3 [&>:first-child]:!mt-0" : "px-5 py-4",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-a:text-[var(--cc-accent)]",
        "prose-img:max-h-[480px] prose-img:rounded-lg prose-img:object-contain",
        "prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:bg-slate-900 prose-pre:p-4",
        "prose-pre:text-slate-100 dark:prose-pre:bg-slate-950",
        "prose-code:before:content-none prose-code:after:content-none",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            return (
              <pre className="digital-note-code-block overflow-x-auto rounded-lg bg-slate-900 p-4 text-[0.875rem] leading-relaxed text-slate-100 dark:bg-slate-950">
                {children}
              </pre>
            )
          },
          code({ className, children, ...props }) {
            const text = String(children).replace(/\n$/, "")
            const isBlock = Boolean(className?.includes("language-"))
            if (isBlock) {
              return (
                <code className={cn("font-mono text-inherit", className)} {...props}>
                  {text}
                </code>
              )
            }
            return (
              <code
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.875em] text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                {...props}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

function EditorToolbar({
  editor,
  disabled,
  onInsertImage,
}: {
  editor: Editor | null
  disabled?: boolean
  onInsertImage: () => void
}) {
  const toolbar = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null
      return {
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        isParagraph:
          ed.isActive("paragraph") &&
          !ed.isActive("heading") &&
          !ed.isActive("bulletList") &&
          !ed.isActive("orderedList") &&
          !ed.isActive("blockquote"),
        isH1: ed.isActive("heading", { level: 1 }),
        isH2: ed.isActive("heading", { level: 2 }),
        isH3: ed.isActive("heading", { level: 3 }),
        isBold: ed.isActive("bold"),
        isItalic: ed.isActive("italic"),
        isUnderline: ed.isActive("underline"),
        isStrike: ed.isActive("strike"),
        isHighlight: ed.isActive("highlight"),
        isCode: ed.isActive("code"),
        isAlignLeft: ed.isActive({ textAlign: "left" }),
        isAlignCenter: ed.isActive({ textAlign: "center" }),
        isAlignRight: ed.isActive({ textAlign: "right" }),
        isAlignJustify: ed.isActive({ textAlign: "justify" }),
        isBulletList: ed.isActive("bulletList"),
        isOrderedList: ed.isActive("orderedList"),
        isBlockquote: ed.isActive("blockquote"),
        isLink: ed.isActive("link"),
      }
    },
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link URL", prev ?? "https://")
    if (url === null) return
    const href = url.trim()
    if (!href) {
      runEditorCommand(editor, () =>
        editor.chain().focus().extendMarkRange("link").unsetLink().run(),
      )
      return
    }
    const { from, to } = editor.state.selection
    if (from === to) {
      runEditorCommand(editor, () =>
        editor.chain().focus().insertContent(`<a href="${href}">${href}</a>`).run(),
      )
    } else {
      runEditorCommand(editor, () =>
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run(),
      )
    }
  }, [editor])

  if (!editor || !toolbar) return null

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="digital-note-editor-toolbar-scroll overflow-x-auto border-b border-[var(--border)] bg-[var(--muted)]/40"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
      >
        <div className="flex w-max min-w-full items-center gap-0.5 px-2 py-1.5">
          <ToolbarButton
            label="Undo"
            disabled={disabled || !toolbar.canUndo}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().undo().run())}
          >
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            disabled={disabled || !toolbar.canRedo}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().redo().run())}
          >
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-7 shrink-0" />

          <ToolbarButton
            label="Paragraph"
            active={toolbar.isParagraph}
            disabled={disabled}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().setParagraph().run())}
          >
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 1"
            active={toolbar.isH1}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleHeading({ level: 1 }).run())
            }
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            active={toolbar.isH2}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleHeading({ level: 2 }).run())
            }
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            active={toolbar.isH3}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleHeading({ level: 3 }).run())
            }
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-7 shrink-0" />

          <ToolbarButton
            label="Bold"
            active={toolbar.isBold}
            disabled={disabled}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().toggleBold().run())}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={toolbar.isItalic}
            disabled={disabled}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().toggleItalic().run())}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={toolbar.isUnderline}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleUnderline().run())
            }
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Strikethrough"
            active={toolbar.isStrike}
            disabled={disabled}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().toggleStrike().run())}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Highlight"
            active={toolbar.isHighlight}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleHighlight().run())
            }
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Inline code"
            active={toolbar.isCode}
            disabled={disabled}
            onClick={() => runEditorCommand(editor, () => editor.chain().focus().toggleCode().run())}
          >
            <Code2 className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-7 shrink-0" />

          <ToolbarButton
            label="Align left"
            active={toolbar.isAlignLeft}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().setTextAlign("left").run())
            }
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Align center"
            active={toolbar.isAlignCenter}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().setTextAlign("center").run())
            }
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            active={toolbar.isAlignRight}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().setTextAlign("right").run())
            }
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Justify"
            active={toolbar.isAlignJustify}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().setTextAlign("justify").run())
            }
          >
            <AlignJustify className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-7 shrink-0" />

          <ToolbarButton
            label="Bullet list"
            active={toolbar.isBulletList}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleBulletList().run())
            }
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            active={toolbar.isOrderedList}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleOrderedList().run())
            }
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Block quote"
            active={toolbar.isBlockquote}
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().toggleBlockquote().run())
            }
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Divider"
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () => editor.chain().focus().setHorizontalRule().run())
            }
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-7 shrink-0" />

          <ToolbarButton
            label="Insert link"
            active={toolbar.isLink}
            disabled={disabled}
            onClick={setLink}
          >
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Remove link"
            disabled={disabled || !toolbar.isLink}
            onClick={() =>
              runEditorCommand(editor, () =>
                editor.chain().focus().extendMarkRange("link").unsetLink().run(),
              )
            }
          >
            <Link2Off className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Insert photo" disabled={disabled} onClick={onInsertImage}>
            <ImagePlus className="h-4 w-4" />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-7 shrink-0" />

          <ToolbarButton
            label="Clear formatting"
            disabled={disabled}
            onClick={() =>
              runEditorCommand(editor, () =>
                editor.chain().focus().clearNodes().unsetAllMarks().run(),
              )
            }
          >
            <Eraser className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>
    </TooltipProvider>
  )
}

function MarkdownNoteEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Start typing your notes…",
  noteKey = null,
  className,
  defaultShowPreview = false,
}: DigitalNoteEditorProps) {
  const originalRef = useRef(value)
  const [markdown, setMarkdown] = useState(() => noteBodyForEditor(value))
  const [showPreview, setShowPreview] = useState(() => Boolean(disabled || defaultShowPreview))
  const [insertingPhoto, setInsertingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadedNoteKey = useRef<string | number | null | undefined>(undefined)

  useEffect(() => {
    if (noteKey !== loadedNoteKey.current) {
      loadedNoteKey.current = noteKey
      const next = noteBodyForEditor(value)
      setMarkdown(next)
      originalRef.current = value
      setShowPreview(Boolean(disabled || defaultShowPreview))
      return
    }
    if (disabled) {
      setMarkdown(noteBodyForEditor(value))
      originalRef.current = value
    }
  }, [noteKey, value, disabled, defaultShowPreview])

  useEffect(() => {
    if (disabled) setShowPreview(true)
  }, [disabled])

  const emitChange = useCallback(
    (next: string) => {
      setMarkdown(next)
      onChange(noteBodyForSave(next, originalRef.current))
    },
    [onChange],
  )

  const insertPhoto = useCallback(async (file: File) => {
    setInsertingPhoto(true)
    try {
      const dataUrl = await readImageAsDataUrl(file)
      const alt = file.name.replace(/\.[^.]+$/, "") || "Photo"
      const snippet = `\n\n![${alt}](${dataUrl})\n\n`
      emitChange(`${markdown.trimEnd()}${snippet}`)
    } catch (err: unknown) {
      toast.error("Could not insert photo", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setInsertingPhoto(false)
    }
  }, [emitChange, markdown])

  return (
    <div className={noteEditorShellClass(Boolean(disabled), className)}>
      {!disabled ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5",
              !showPreview && "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)] hover:text-white",
            )}
            onClick={() => setShowPreview(false)}
          >
            <PenLine className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5",
              showPreview && "bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)] hover:text-white",
            )}
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Separator orientation="vertical" className="mx-1 h-7" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            disabled={insertingPhoto || showPreview}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Photo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void insertPhoto(file)
            }}
          />
        </div>
      ) : null}

      {showPreview || disabled ? (
        <div data-notes-scroll className="digital-note-markdown-preview min-h-0 flex-1 overflow-y-auto">
          {markdown.trim() ? (
            <MarkdownNotePreview markdown={markdown} />
          ) : (
            <p
              className={cn(
                "text-sm text-[var(--cc-text-muted)]",
                isDesktopAppShell() ? "px-0 pt-1 pb-3" : "px-5 py-4",
              )}
            >
              {placeholder}
            </p>
          )}
        </div>
      ) : (
        <textarea
          value={markdown}
          onChange={(event) => emitChange(event.target.value)}
          placeholder={placeholder}
          data-notes-scroll
          className="min-h-0 w-full flex-1 resize-none overflow-y-auto bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-[var(--cc-text)] outline-none"
          spellCheck
        />
      )}
    </div>
  )
}

function RichHtmlNoteEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Start typing your notes…",
  className,
  noteKey = null,
}: DigitalNoteEditorProps) {
  const loadedNoteKey = useRef<string | number | null | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        horizontalRule: false,
        link: false,
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      HorizontalRule,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "digital-note-embedded-image",
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: prepareNoteContentForEditor(value) || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert max-w-none focus:outline-none text-base text-[var(--cc-text)]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const prepared = prepareNoteContentForEditor(value) || ""

    if (noteKey !== loadedNoteKey.current) {
      loadedNoteKey.current = noteKey
      editor.commands.setContent(prepared, { emitUpdate: false })
      return
    }

    if (editor.isEmpty && prepared && prepared !== "<p></p>") {
      editor.commands.setContent(prepared, { emitUpdate: false })
    }
  }, [editor, noteKey, value])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  const insertImageFromFile = useCallback(
    async (file: File) => {
      if (!editor || disabled) return
      try {
        const dataUrl = await readImageAsDataUrl(file)
        const alt = file.name.replace(/\.[^.]+$/, "") || "Photo"
        runEditorCommand(editor, () =>
          editor.chain().focus().setImage({ src: dataUrl, alt }).run(),
        )
      } catch (err: unknown) {
        toast.error("Could not insert photo", {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    },
    [disabled, editor],
  )

  return (
    <div className={noteEditorShellClass(Boolean(disabled), className, true)}>
      {!disabled ? (
        <>
          <EditorToolbar
            editor={editor}
            disabled={disabled}
            onInsertImage={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void insertImageFromFile(file)
            }}
          />
        </>
      ) : null}
      <div className={cn("flex min-h-0 flex-1 flex-col [&_.tiptap]:h-full", disabled && "pointer-events-none")}>
        <EditorContent editor={editor} className="min-h-0 flex-1" />
      </div>
    </div>
  )
}

export function DigitalNoteEditor(props: DigitalNoteEditorProps) {
  const { value, noteKey = null, preferRich = false, defaultShowPreview = false } = props
  const richValue = preferRich && isMarkdownNoteContent(value) ? markdownToNoteHtml(value) : value
  const modeRef = useRef({ noteKey, markdown: !preferRich && isMarkdownNoteContent(value) })

  if (preferRich) {
    return <RichHtmlNoteEditor key={`html-${noteKey ?? "new"}`} {...props} value={richValue} />
  }

  if (modeRef.current.noteKey !== noteKey) {
    modeRef.current = { noteKey, markdown: isMarkdownNoteContent(value) }
  } else if (!modeRef.current.markdown && isMarkdownNoteContent(value)) {
    // Late hydrate (e.g. Cora body arrives after first paint)
    modeRef.current.markdown = true
  }

  if (modeRef.current.markdown) {
    return <MarkdownNoteEditor key={`md-${noteKey ?? "new"}`} {...props} />
  }

  return <RichHtmlNoteEditor key={`html-${noteKey ?? "new"}`} {...props} />
}
