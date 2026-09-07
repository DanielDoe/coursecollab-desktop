/** Shared layout classes for instructor lecture modals (overrides default sm:max-w-lg dialog). */
export const LECTURE_DIALOG_SHELL =
  "flex flex-col w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] sm:max-w-4xl lg:max-w-5xl max-h-[92dvh] p-0 gap-0 overflow-hidden"

export const LECTURE_DIALOG_SHELL_WIDE =
  "flex flex-col w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-5xl lg:max-w-6xl max-h-[92dvh] p-0 gap-0 overflow-hidden"

export const LECTURE_DIALOG_SHELL_COMPACT =
  "flex flex-col w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90dvh] h-auto p-0 gap-0 overflow-hidden"

export const LECTURE_DIALOG_SHELL_DECK_PREVIEW =
  "flex flex-col w-[calc(100vw-1.25rem)] max-w-[calc(100vw-1.25rem)] sm:max-w-3xl lg:max-w-4xl max-h-[92dvh] p-0 gap-0 overflow-hidden"

export const LECTURE_DIALOG_HEADER =
  "shrink-0 space-y-1.5 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[var(--border)] text-left pr-14 sm:pr-16"

export const LECTURE_DIALOG_ACTIONS =
  "shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-5 sm:px-6 pb-4 border-b border-[var(--border)] bg-[var(--muted)]/40"

export const LECTURE_DIALOG_BODY =
  "flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 sm:py-6"

export const LECTURE_DIALOG_BODY_FIT =
  "shrink-0 px-5 sm:px-6 py-4 sm:py-5"

export const LECTURE_DIALOG_FOOTER =
  "shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-[var(--border)] px-5 sm:px-6 py-4 bg-[var(--muted)]/50"

export const LECTURE_DIALOG_FOOTER_INSET =
  "shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 border-t border-[var(--border)] px-5 sm:px-6 py-4 bg-[var(--muted)]/50"
