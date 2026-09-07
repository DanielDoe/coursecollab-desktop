/** Visual tokens matched to Magnific reference chrome (drawer + header). */
export const MAGNIFIC = {
  pink: "#E8176F",
  pinkHover: "#D01463",
  sidebarBg: "#FFFFFF",
  shellBg: "#F2F2F2",
  searchBg: "#E9E9E9",
  searchBgHover: "#E3E3E3",
  border: "#EBEBEB",
  navText: "#1A1A1A",
  navMuted: "#6B6B6B",
  navHover: "#F5F5F5",
  navActive: "#EFEFEF",
  sidebarWidth: 230,
  sidebarCollapsed: 72,
} as const

export const magnificShellClass = "dashboard-v2-magnific-shell"

/** Floating white card — drawer, header, content panels */
export const magnificShellCardClass =
  "rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_20px_rgba(0,0,0,0.07)] dark:border-[#262626] dark:bg-[#111111] dark:shadow-[0_2px_20px_rgba(0,0,0,0.35)]"

/** Merged main scroll area — horizontal padding only; divider lives on module shell */
export const magnificMergedMainClass =
  "px-3 pb-3 pt-0 sm:px-4 sm:pb-4 md:px-5 md:pb-5 lg:px-5"

/** Breadcrumb row inside merged topbar — sits above module content hairline */
export const magnificMergedBreadcrumbsClass = "pt-3.5 pb-0 sm:pt-4 sm:pb-0"

/** Sidebar nav hover — never use light hover fill in dark mode (icons vanish). */
export const magnificSidebarNavHoverClass =
  "transition-colors hover:bg-[#F5F5F5] hover:text-[#1A1A1A] dark:hover:bg-[#1A1A1A] dark:hover:text-white"

export const magnificSidebarNavItemClass =
  "rounded-md text-[#1A1A1A] dark:text-[#E5E5E5] transition-colors hover:bg-[#F5F5F5] hover:text-[#1A1A1A] dark:hover:bg-[#1A1A1A] dark:hover:text-white"

export const magnificSidebarNavItemActiveClass =
  "bg-[#EFEFEF] font-medium text-[#1A1A1A] dark:bg-[#262626] dark:text-white"

export const magnificSidebarNavIconClass = (isActive: boolean) =>
  isActive
    ? "text-[#1A1A1A] dark:text-white"
    : "text-[#1A1A1A] dark:text-[#A3A3A3] group-hover:dark:text-white"

