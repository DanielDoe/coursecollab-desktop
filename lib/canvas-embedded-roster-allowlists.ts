import {
  canonicalSessionCode,
  normalizedSectionVariantsForSql,
  SESSION_LEGACY_TO_CANONICAL,
} from "@/lib/session-code-aliases"

/**
 * Spring 2026 ELEG1301P01 — Canvas roster allowlist for gradebook export.
 * Student names are quoted so commas inside names parse as one CSV field.
 */
const ELEG1301P01_SPRING2026_ROSTER_CSV = `Student,ID,SIS User ID,SIS Login ID,Section
"Ashby, Michael",42417,609690,mashby3,Spring2026_ELEG1301P01-2620-20278
"Avant, Alyvia",17877,511431,aavant1,Spring2026_ELEG1301P01-2620-20278
"Ayers, Tony",43892,631279,tayers3,Spring2026_ELEG1301P01-2620-20278
"Bell, Aymardria",44061,610691,abell81,Spring2026_ELEG1301P01-2620-20278
"Bisuga, Teniola",47850,637117,tbisuga,Spring2026_ELEG1301P01-2620-20278
"Calhoun, Dameion Jr",43937,609169,dcalhounjr,Spring2026_ELEG1301P01-2620-20278
"Choice, Jeremiah",44144,606337,jchoice3,Spring2026_ELEG1301P01-2620-20278
"Cox, Kolton",43883,606803,kcox20,Spring2026_ELEG1301P01-2620-20278
"Davis, Edward",44039,609027,edavis82,Spring2026_ELEG1301P01-2620-20278
"Gaines, Tavarus",36723,585790,tgaines19,Spring2026_ELEG1301P01-2620-20278
"Gardner, Eugene",42368,615230,egardner5,Spring2026_ELEG1301P01-2620-20278
"Gutierrez, Louis",43537,633853,lgutierrez7,Spring2026_ELEG1301P01-2620-20278
"Hale, Jaylen",43607,623775,jhale13,Spring2026_ELEG1301P01-2620-20278
"Hammonds, Jayvon",44099,587498,jhammonds3,Spring2026_ELEG1301P01-2620-20278
"Henry, Jaden",44029,630284,jhenry61,Spring2026_ELEG1301P01-2620-20278
"Holcombe, Tyler",44815,607297,tholcombe1,Spring2026_ELEG1301P01-2620-20278
"Julian, Zoe",43606,626041,zjulian,Spring2026_ELEG1301P01-2620-20278
"Lawson, Myles",30585,548577,mlawson13,Spring2026_ELEG1301P01-2620-20278
"Louis, Jace",44947,620173,jlouis9,Spring2026_ELEG1301P01-2620-20278
"Mcdowell, Patrick",43052,561158,pmcdowell2,Spring2026_ELEG1301P01-2620-20278
"Miller, Kerrion",35909,579156,kmiller75,Spring2026_ELEG1301P01-2620-20278
"Morton, Rajanae",43512,460275,rmorton2,Spring2026_ELEG1301P01-2620-20278
"North, Kerry",47922,528285,knorth2,Spring2026_ELEG1301P01-2620-20278
"Okoronkwo, Jameschukwuebuka",47632,645632,jokoronkwo1,Spring2026_ELEG1301P01-2620-20278
"Onwube, Rita",37085,585864,ronwube,Spring2026_ELEG1301P01-2620-20278
"Parker, Jayla",36120,576671,jparker68,Spring2026_ELEG1301P01-2620-20278
"Smalley, Chase",45006,633629,csmalley,Spring2026_ELEG1301P01-2620-20278
"Swain, Jyeshuah",37116,580000,jswain5,Spring2026_ELEG1301P01-2620-20278
"Tillery, Angel",42651,606755,atillery1,Spring2026_ELEG1301P01-2620-20278
"Walker, David",45220,592125,dwalker118,Spring2026_ELEG1301P01-2620-20278
"Wallace, Jurnei",43256,617960,jwallace56,Spring2026_ELEG1301P01-2620-20278
"Wesley, Cornell",42471,612193,cwesley16,Spring2026_ELEG1301P01-2620-20278
"West, Haynes",38340,593897,hwest3,Spring2026_ELEG1301P01-2620-20278
"Wilder, Ashtan",47638,595604,awilder4,Spring2026_ELEG1301P01-2620-20278
"Williams, Cameron",37074,587263,cwilliams500,Spring2026_ELEG1301P01-2620-20278`

const BY_CANONICAL_SECTION: Readonly<Record<string, string>> = {
  ELEG1301P01: ELEG1301P01_SPRING2026_ROSTER_CSV,
}

/**
 * Built-in roster CSV for known sections (no paste required). Returns null for “All” or unknown sections.
 * Matches canonical codes, legacy aliases, and Canvas-style section strings that contain the code * (e.g. `Spring2026_ELEG1301P01-2620-20278`).
 */
export function getEmbeddedCanvasRosterAllowlistCsv(sectionFilter: string): string | null {
  const raw = String(sectionFilter ?? "").trim()
  if (!raw || raw.toLowerCase() === "all") return null

  const candidates = new Set<string>()
  candidates.add(canonicalSessionCode(raw).trim().toUpperCase())
  for (const v of normalizedSectionVariantsForSql(raw)) {
    candidates.add(canonicalSessionCode(v).trim().toUpperCase())
  }

  for (const c of candidates) {
    const csv = BY_CANONICAL_SECTION[c]
    if (csv) return csv
  }

  const upper = raw.toUpperCase()
  for (const key of Object.keys(BY_CANONICAL_SECTION)) {
    if (upper.includes(key)) return BY_CANONICAL_SECTION[key]!
  }

  for (const [legacy, canonical] of Object.entries(SESSION_LEGACY_TO_CANONICAL)) {
    if (upper.includes(legacy.toUpperCase())) {
      const csv = BY_CANONICAL_SECTION[canonical.trim().toUpperCase()]
      if (csv) return csv
    }
  }

  return null
}
