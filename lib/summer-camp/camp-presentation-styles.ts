/**
 * Presentation-mode readability — slide chrome stays dark; content body is always light.
 * Import these classes anywhere camp content renders inside CampPresentationModuleLayout.
 */

/** Force readable interactive controls when the site is in dark mode but slide wells stay light. */
export const CAMP_PRESENTATION_INTERACTIVE = "camp-presentation-interactive"

/** Neutralize dark-mode utility classes inside forced-light presentation wells. */
export const CAMP_PRESENTATION_DARK_RESET = "camp-presentation-dark-reset"

/** Responsive overflow + media scaling inside presentation wells. */
export const CAMP_PRESENTATION_RESPONSIVE =
  "max-w-full min-w-0 " +
  "[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_code]:break-words " +
  "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto " +
  "[&_img]:max-w-full [&_img]:h-auto [&_video]:max-w-full " +
  "[&_.overflow-x-auto]:-mx-1 [&_.overflow-x-auto]:px-1 sm:[&_.overflow-x-auto]:mx-0 sm:[&_.overflow-x-auto]:px-0"

/** Solid white content well on dark presentation slides — fixes black-on-dark text bugs. */
export const CAMP_PRESENTATION_SLIDE_BODY =
  "w-full min-w-0 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-lg !text-slate-900 " +
  "[&_p]:!text-slate-700 [&_h3]:!text-slate-900 [&_h4]:!text-slate-800 [&_li]:!text-slate-700 [&_strong]:!text-slate-900 [&_label]:!text-slate-800 " +
  "[&_.text-slate-400]:!text-slate-600 [&_.text-slate-500]:!text-slate-600 [&_.text-slate-600]:!text-slate-700 " +
  "[&_[data-camp-hero]_p]:!text-sky-100/95 [&_[data-camp-hero]_h1]:!text-white [&_[data-camp-hero]_.text-violet-200]:!text-sky-100/95 " +
  CAMP_PRESENTATION_RESPONSIVE +
  " " +
  CAMP_PRESENTATION_INTERACTIVE +
  " " +
  CAMP_PRESENTATION_DARK_RESET

/** Nested panels (checkpoint, profile form, step) inside presentation. */
export const CAMP_PRESENTATION_NESTED_PANEL =
  "rounded-xl border border-slate-200 bg-white !text-slate-900 shadow-sm " +
  "[&_p]:!text-slate-700 [&_.text-slate-600]:!text-slate-600 [&_.text-slate-500]:!text-slate-500 " +
  CAMP_PRESENTATION_INTERACTIVE +
  " " +
  CAMP_PRESENTATION_DARK_RESET

/** CampModernSurface + cards in presentation — same contrast rules. */
export const CAMP_PRESENTATION_SURFACE =
  "from-white to-white !bg-white !text-slate-900 dark:!bg-white dark:!from-white dark:!to-white dark:!text-slate-900 " +
  "[&_p]:!text-slate-700 [&_h3]:!text-slate-900 [&_h4]:!text-slate-800 [&_li]:!text-slate-700 [&_strong]:!text-slate-900 " +
  "[&_.text-slate-400]:!text-slate-600 [&_.text-slate-500]:!text-slate-600 [&_.text-slate-600]:!text-slate-700 [&_.camp-flow-panel_p]:!text-slate-700 " +
  CAMP_PRESENTATION_RESPONSIVE +
  " " +
  CAMP_PRESENTATION_INTERACTIVE +
  " " +
  CAMP_PRESENTATION_DARK_RESET
