/** Landing summer-camp banner window: May 1 – Aug 15 (local time). */
export function isSummerSeason(date = new Date()): boolean {
  const month = date.getMonth()
  const day = date.getDate()
  if (month < 4) return false // before May
  if (month > 7) return false // after August
  if (month === 7 && day > 15) return false // after Aug 15
  if (month === 4) return day >= 1 // May 1+
  return true // May 1 – Aug 15
}

export function getSummerYear(date = new Date()): number {
  return date.getFullYear()
}

export function summerBannerStorageKey(year: number): string {
  return `cc_summer_banner_dismissed_${year}`
}
