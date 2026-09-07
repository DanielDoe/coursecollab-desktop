/** Individual vs institutional annual cost at representative license capacities. */

export const STUDENT_PER_SEMESTER = 39.99
export const FACULTY_PER_SEMESTER = 99

export type LicenseComparisonRow = {
  key: string
  name: string
  short: string
  students: number
  faculty: number
  institutional: number
  facultyIllustrative: boolean
  emphasize: "department" | "college" | null
}

export const LICENSE_COMPARISON: LicenseComparisonRow[] = [
  { key: "pilot", name: "Course Pilot", short: "Pilot", students: 125, faculty: 3, institutional: 9_500, facultyIllustrative: false, emphasize: null },
  { key: "program", name: "Program", short: "Program", students: 250, faculty: 10, institutional: 18_500, facultyIllustrative: true, emphasize: null },
  { key: "department", name: "Department", short: "Department", students: 500, faculty: 15, institutional: 29_500, facultyIllustrative: true, emphasize: "department" },
  { key: "department_plus", name: "Department Plus", short: "Dept Plus", students: 1_000, faculty: 30, institutional: 49_500, facultyIllustrative: true, emphasize: null },
  { key: "college", name: "College", short: "College", students: 2_500, faculty: 75, institutional: 89_500, facultyIllustrative: true, emphasize: "college" },
  { key: "college_plus", name: "College Plus", short: "College+", students: 5_000, faculty: 150, institutional: 149_500, facultyIllustrative: true, emphasize: null },
]

export function individualCost(row: LicenseComparisonRow, semesters: 2 | 3) {
  return row.students * STUDENT_PER_SEMESTER * semesters + row.faculty * FACULTY_PER_SEMESTER * semesters
}

export function savings(row: LicenseComparisonRow, semesters: 2 | 3) {
  return individualCost(row, semesters) - row.institutional
}

export function savingsPct(row: LicenseComparisonRow, semesters: 2 | 3) {
  return (savings(row, semesters) / individualCost(row, semesters)) * 100
}

export function money(value: number) {
  const cents = Math.round(value * 100) % 100 !== 0
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

export function moneyAxis(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}
