/**
 * Student Color Hunt — web dashboard KPI thumbs.
 * Reference: course-collab-mobile/expo/docs/student-color-hunt-palettes.md
 */

export const COLOR_HUNT = {
  orange: "#FF6A1C",
  yellow: "#FFDA62",
  amber: "#FFAE56",
  pink: "#F5788B",
  ink: "#4A2E0A",
} as const

export const COLOR_HUNT_COOL = {
  gold: "#FFC349",
  indigo: "#525EA7",
  cyan: "#5FACD3",
  sky: "#97DDE9",
} as const

/**
 * Canonical Color Hunt palettes for module chrome (one locked scheme per family).
 * Soft → mid-light → mid → deep. Do not mix stops across families on one surface.
 *
 * Locked picks (Aug 2026):
 * - green  materialGreen  https://colorhunt.co/palette/e8f5e9a5d6a766bb6a1b5e20
 * - purple atelierNight   https://colorhunt.co/palette/3a10784e31aa3795bdf7f7f8
 * - red    crimsonCream   https://colorhunt.co/palette/be1a1ad0311ef7d87ff8ebab
 * - gold   warmFlame      https://colorhunt.co/palette/e73f1efb6c00f9b637ffdd9c
 * - blue   materialBlue   https://colorhunt.co/palette/e3f2fd90caf92196f30d47a1
 * - metal  quietSlate     https://colorhunt.co/palette/f1f6f9394867212a3e9ba4b5
 * - pink   coralViolet    https://colorhunt.co/palette/ffca95ff7873e22f808140dc
 *
 * Also catalogued (alternates / thumbs — not the locked chrome swatch):
 * https://colorhunt.co/palette/eeeeee6fcf972fa0841f6f5f
 * https://colorhunt.co/palette/0e2148483aa07965c1e3d095
 * https://colorhunt.co/palette/4335a780c4e9fff6e9ff7f3e
 * https://colorhunt.co/palette/8b1e2de63946f4d35e457b9d
 * https://colorhunt.co/palette/d92243f69d39e0c375fff5e5
 * https://colorhunt.co/palette/800000982b1cdad4b5f2e8c6
 * https://colorhunt.co/palette/e2852ef5c857ffee91abe0f0
 * https://colorhunt.co/palette/2c5ead1591dc4bb8fac4e2f5
 * https://colorhunt.co/palette/f8fafcd9eafdbcccdc9aa6b2
 */
export const COLOR_HUNT_PALETTES = {
  coolGold: ["#FFC349", "#525EA7", "#5FACD3", "#97DDE9"],
  /** Locked blue chrome — soft ice → navy */
  materialBlue: ["#E3F2FD", "#90CAF9", "#2196F3", "#0D47A1"],
  /** Locked gold / ember chrome — cream → flame (Color Hunt order reversed to soft→deep) */
  warmFlame: ["#E73F1E", "#FB6C00", "#F9B637", "#FFDD9C"],
  boldPop: ["#007DCC", "#FFB900", "#D10056", "#B2054C"],
  tealMango: ["#224248", "#325E6A", "#44A1A4", "#FF9A00"],
  seaCoral: ["#249D8F", "#E9C46A", "#E76F51", "#FDF0D5"],
  inkAqua: ["#222831", "#393E46", "#00ADB5", "#EEEEEE"],
  parchment: ["#B7C4CF", "#EEE3CB", "#D7C0AE", "#967E76"],
  duskRose: ["#364F6B", "#3FC1C9", "#F5F5F5", "#FC5185"],
  purpleBlush: ["#FFF4BF", "#FFBEFB", "#DC95FF", "#8C56D4"],
  coralViolet: ["#FFCA95", "#FF7873", "#E22F80", "#8140DC"],
  royalGold: ["#4D2B8C", "#85409D", "#EEA727", "#FFEF5F"],
  violetBloom: ["#462C7D", "#831C91", "#D552A3", "#FF70BF"],
  /** Locked purple chrome — soft→deep from Color Hunt 3a1078… */
  atelierNight: ["#F7F7F8", "#3795BD", "#4E31AA", "#3A1078"],
  /** Alternate purple (navy night + cream) */
  violetHarbor: ["#E3D095", "#7965C1", "#483AA0", "#0E2148"],
  aquaMint: ["#30AFFF", "#92EEFF", "#D8FFC5", "#C4F7CA"],
  /** Locked green chrome */
  materialGreen: ["#E8F5E9", "#A5D6A7", "#66BB6A", "#1B5E20"],
  /** Teal mint alternate (Meridian-adjacent) */
  mintGrove: ["#EEEEEE", "#6FCF97", "#2FA084", "#1F6F5F"],
  forestLime: ["#063B00", "#266210", "#90B800", "#E1E100"],
  oliveCitrus: ["#769826", "#A1CB35", "#FFDE4E", "#FF9D4D"],
  springLeaf: ["#499A13", "#BBDC12", "#8ECA3C", "#276F27"],
  honeyToast: ["#FEF2A0", "#F3CD97", "#E98B50", "#BC4F4F"],
  mustardFlame: ["#F5F5DC", "#FBC02D", "#FF8F00", "#C62828"],
  sunsetCoral: ["#FF6A1C", "#FFDA62", "#FFAE56", "#F5788B"],
  sageGold: ["#767F9E", "#DAA464", "#DEC384", "#E8DDB4"],
  trafficAmber: ["#FFD400", "#FFC300", "#FF8C00", "#FF5F00"],
  harvestOak: ["#7B542F", "#B6771D", "#FF9D00", "#FFCF71"],
  goldenCream: ["#FEF3E2", "#F3C623", "#FFB22C", "#FA812F"],
  amberSky: ["#E2852E", "#F5C857", "#FFEE91", "#ABE0F0"],
  citrusFlash: ["#FF9B00", "#FFE100", "#FFC900", "#EBE389"],
  /** Locked red / crimson gallery chrome — cream → UH-adjacent red */
  crimsonCream: ["#F8EBAB", "#F7D87F", "#D0311E", "#BE1A1A"],
  /** UH Steel — https://colorhunt.co/palette/eee2deea906cb313122b2a4c */
  uhCougarSteel: ["#EEE2DE", "#EA906C", "#B31312", "#2B2A4C"],
  /** Heritage wine parchment */
  wineParchment: ["#F2E8C6", "#DAD4B5", "#982B1C", "#800000"],
  /** Rose amber alternate */
  roseAmber: ["#FFF5E5", "#E0C375", "#F69D39", "#D92243"],
  /** Locked quiet metals chrome */
  quietSlate: ["#F1F6F9", "#9BA4B5", "#394867", "#212A3E"],
  softSteel: ["#F8FAFC", "#D9EAFD", "#BCCCDC", "#9AA6B2"],
  /** Clear ocean alternate */
  oceanClear: ["#C4E2F5", "#4BB8FA", "#1591DC", "#2C5EAD"],
} as const

export type ContentChromeFamily = "blue" | "purple" | "gold" | "red" | "green" | "pink" | "neutral"

/** Locked family → Color Hunt key (module chrome source of truth). */
export const LOCKED_MODULE_CHROME_PALETTE = {
  purple: "atelierNight",
  gold: "warmFlame",
  red: "crimsonCream",
  green: "materialGreen",
  pink: "coralViolet",
  blue: "materialBlue",
  neutral: "quietSlate",
} as const satisfies Record<ContentChromeFamily, keyof typeof COLOR_HUNT_PALETTES>

/** Palettes that sit next to CourseCollab purple without fighting it. */
export const PURPLE_COMPLEMENT_PALETTES = {
  purpleBlush: COLOR_HUNT_PALETTES.purpleBlush,
  coralViolet: COLOR_HUNT_PALETTES.coralViolet,
  royalGold: COLOR_HUNT_PALETTES.royalGold,
  violetBloom: COLOR_HUNT_PALETTES.violetBloom,
} as const

/** Palettes that sit next to green themes without fighting them. */
export const GREEN_COMPLEMENT_PALETTES = {
  aquaMint: COLOR_HUNT_PALETTES.aquaMint,
  materialGreen: COLOR_HUNT_PALETTES.materialGreen,
  forestLime: COLOR_HUNT_PALETTES.forestLime,
  oliveCitrus: COLOR_HUNT_PALETTES.oliveCitrus,
  springLeaf: COLOR_HUNT_PALETTES.springLeaf,
} as const

/** Gold / amber / harvest suggestions for gold brand themes (e.g. PVAMU gold). */
export const GOLD_COMPLEMENT_PALETTES = {
  sageGold: COLOR_HUNT_PALETTES.sageGold,
  warmFlame: COLOR_HUNT_PALETTES.warmFlame,
  amberSky: COLOR_HUNT_PALETTES.amberSky,
  citrusFlash: COLOR_HUNT_PALETTES.citrusFlash,
  goldenCream: COLOR_HUNT_PALETTES.goldenCream,
  honeyToast: COLOR_HUNT_PALETTES.honeyToast,
  mustardFlame: COLOR_HUNT_PALETTES.mustardFlame,
  sunsetCoral: COLOR_HUNT_PALETTES.sunsetCoral,
  trafficAmber: COLOR_HUNT_PALETTES.trafficAmber,
  harvestOak: COLOR_HUNT_PALETTES.harvestOak,
} as const

/**
 * Gold list thumbs — play across the curated gold Color Hunt set
 * (cream, sky cool accent, pale gold, sage metal, amber, citrus, slate).
 */
export const GOLD_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.goldenCream[0], // #FEF3E2 cream
  COLOR_HUNT_PALETTES.amberSky[3], // #ABE0F0 sky
  COLOR_HUNT_PALETTES.amberSky[2], // #FFEE91 pale
  COLOR_HUNT_PALETTES.sageGold[3], // #E8DDB4 soft sage cream
  COLOR_HUNT_PALETTES.amberSky[1], // #F5C857 gold
  COLOR_HUNT_PALETTES.sageGold[1], // #DAA464 sage gold
  COLOR_HUNT_PALETTES.goldenCream[2], // #FFB22C amber
  COLOR_HUNT_PALETTES.goldenCream[3], // #FA812F orange
  COLOR_HUNT_PALETTES.warmFlame[3], // #FFDD9C flame cream
  COLOR_HUNT_PALETTES.citrusFlash[1], // #FFE100 citrus
  COLOR_HUNT_PALETTES.amberSky[0], // #E2852E deep amber
  COLOR_HUNT_PALETTES.sageGold[0], // #767F9E slate
] as const

/** Soft → deep gold chrome — locked warmFlame (cream → flame). */
export const GOLD_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.warmFlame[3],
  COLOR_HUNT_PALETTES.warmFlame[2],
  COLOR_HUNT_PALETTES.warmFlame[1],
  COLOR_HUNT_PALETTES.warmFlame[0],
] as const

/**
 * Inspired family combinations (same idea as gold): soft washes + mid accents +
 * one cool/complement break so lists aren't a single flat hue.
 */
export const PURPLE_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.atelierNight[0],
  COLOR_HUNT_PALETTES.atelierNight[1],
  COLOR_HUNT_PALETTES.violetHarbor[0],
  COLOR_HUNT_PALETTES.purpleBlush[1],
  COLOR_HUNT_PALETTES.atelierNight[2],
  COLOR_HUNT_PALETTES.coralViolet[0],
  COLOR_HUNT_PALETTES.atelierNight[3],
  COLOR_HUNT_PALETTES.violetHarbor[3],
  COLOR_HUNT_PALETTES.violetBloom[0],
  "#582C83",
] as const

/** Soft → deep purple chrome — locked atelierNight. */
export const PURPLE_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.atelierNight[0],
  COLOR_HUNT_PALETTES.atelierNight[1],
  COLOR_HUNT_PALETTES.atelierNight[2],
  COLOR_HUNT_PALETTES.atelierNight[3],
] as const

export const RED_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.crimsonCream[0],
  COLOR_HUNT_PALETTES.crimsonCream[1],
  COLOR_HUNT_PALETTES.roseAmber[1],
  COLOR_HUNT_PALETTES.wineParchment[0],
  COLOR_HUNT_PALETTES.crimsonCream[2],
  COLOR_HUNT_PALETTES.roseAmber[2],
  COLOR_HUNT_PALETTES.crimsonCream[3],
  COLOR_HUNT_PALETTES.wineParchment[3],
  COLOR_HUNT_PALETTES.roseAmber[3],
] as const

/** Soft → deep red chrome — locked crimsonCream. */
export const RED_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.crimsonCream[0],
  COLOR_HUNT_PALETTES.crimsonCream[1],
  COLOR_HUNT_PALETTES.crimsonCream[2],
  COLOR_HUNT_PALETTES.crimsonCream[3],
] as const

export const GREEN_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.materialGreen[0],
  COLOR_HUNT_PALETTES.mintGrove[0],
  COLOR_HUNT_PALETTES.materialGreen[1],
  COLOR_HUNT_PALETTES.mintGrove[1],
  COLOR_HUNT_PALETTES.materialGreen[2],
  COLOR_HUNT_PALETTES.mintGrove[2],
  COLOR_HUNT_PALETTES.materialGreen[3],
  COLOR_HUNT_PALETTES.mintGrove[3],
  COLOR_HUNT_PALETTES.springLeaf[0],
] as const

export const GREEN_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.materialGreen[0],
  COLOR_HUNT_PALETTES.materialGreen[1],
  COLOR_HUNT_PALETTES.materialGreen[2],
  COLOR_HUNT_PALETTES.materialGreen[3],
] as const

export const PINK_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.coralViolet[0],
  COLOR_HUNT_PALETTES.duskRose[2],
  COLOR_HUNT_PALETTES.sunsetCoral[1],
  COLOR_HUNT_PALETTES.coralViolet[1],
  COLOR_HUNT_PALETTES.duskRose[3],
  COLOR_HUNT_PALETTES.coralViolet[2],
  COLOR_HUNT_PALETTES.sunsetCoral[3],
  COLOR_HUNT_PALETTES.coralViolet[3],
  COLOR_HUNT_PALETTES.duskRose[0],
] as const

export const PINK_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.coralViolet[0],
  COLOR_HUNT_PALETTES.coralViolet[1],
  COLOR_HUNT_PALETTES.coralViolet[2],
  COLOR_HUNT_PALETTES.coralViolet[3],
] as const

export const BLUE_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.materialBlue[0],
  COLOR_HUNT_PALETTES.oceanClear[0],
  COLOR_HUNT_PALETTES.materialBlue[1],
  COLOR_HUNT_PALETTES.coolGold[3],
  COLOR_HUNT_PALETTES.materialBlue[2],
  COLOR_HUNT_PALETTES.oceanClear[2],
  COLOR_HUNT_PALETTES.coolGold[1],
  COLOR_HUNT_PALETTES.materialBlue[3],
  COLOR_HUNT_PALETTES.oceanClear[3],
] as const

export const BLUE_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.materialBlue[0],
  COLOR_HUNT_PALETTES.materialBlue[1],
  COLOR_HUNT_PALETTES.materialBlue[2],
  COLOR_HUNT_PALETTES.materialBlue[3],
] as const

export const NEUTRAL_CONTENT_THUMBS = [
  COLOR_HUNT_PALETTES.quietSlate[0],
  COLOR_HUNT_PALETTES.softSteel[0],
  COLOR_HUNT_PALETTES.softSteel[1],
  COLOR_HUNT_PALETTES.quietSlate[1],
  COLOR_HUNT_PALETTES.softSteel[2],
  COLOR_HUNT_PALETTES.quietSlate[2],
  COLOR_HUNT_PALETTES.softSteel[3],
  COLOR_HUNT_PALETTES.quietSlate[3],
] as const

/** Soft → deep quiet metals chrome — locked quietSlate. */
export const NEUTRAL_CONTENT_SWATCH = [
  COLOR_HUNT_PALETTES.quietSlate[0],
  COLOR_HUNT_PALETTES.quietSlate[1],
  COLOR_HUNT_PALETTES.quietSlate[2],
  COLOR_HUNT_PALETTES.quietSlate[3],
] as const

export function contentThumbsForFamily(family: ContentChromeFamily): readonly string[] {
  switch (family) {
    case "gold":
      return GOLD_CONTENT_THUMBS
    case "purple":
      return PURPLE_CONTENT_THUMBS
    case "red":
      return RED_CONTENT_THUMBS
    case "green":
      return GREEN_CONTENT_THUMBS
    case "pink":
      return PINK_CONTENT_THUMBS
    case "neutral":
      return NEUTRAL_CONTENT_THUMBS
    case "blue":
    default:
      return BLUE_CONTENT_THUMBS
  }
}

export function contentSwatchForFamily(family: ContentChromeFamily): readonly [string, string, string, string] {
  switch (family) {
    case "gold":
      return GOLD_CONTENT_SWATCH
    case "purple":
      return PURPLE_CONTENT_SWATCH
    case "red":
      return RED_CONTENT_SWATCH
    case "green":
      return GREEN_CONTENT_SWATCH
    case "pink":
      return PINK_CONTENT_SWATCH
    case "neutral":
      return NEUTRAL_CONTENT_SWATCH
    case "blue":
    default:
      return BLUE_CONTENT_SWATCH
  }
}

/** Study session chrome — solid fills from COLOR_HUNT_PALETTES. */
export const FLASHCARD_STUDY_SWATCH = {
  gold: COLOR_HUNT_PALETTES.coolGold[0],
  indigo: COLOR_HUNT_PALETTES.coolGold[1],
  cyan: COLOR_HUNT_PALETTES.coolGold[2],
  sky: COLOR_HUNT_PALETTES.coolGold[3],
  ice: COLOR_HUNT_PALETTES.materialBlue[0],
  powder: COLOR_HUNT_PALETTES.materialBlue[1],
  blue: COLOR_HUNT_PALETTES.materialBlue[2],
  navy: COLOR_HUNT_PALETTES.materialBlue[3],
  red: COLOR_HUNT_PALETTES.warmFlame[0],
  orange: COLOR_HUNT_PALETTES.warmFlame[1],
  amber: COLOR_HUNT_PALETTES.warmFlame[2],
  cream: COLOR_HUNT_PALETTES.warmFlame[3],
  azure: COLOR_HUNT_PALETTES.boldPop[0],
  yellow: COLOR_HUNT_PALETTES.boldPop[1],
  magenta: COLOR_HUNT_PALETTES.boldPop[2],
  burgundy: COLOR_HUNT_PALETTES.boldPop[3],
  tealDeep: COLOR_HUNT_PALETTES.tealMango[0],
  teal: COLOR_HUNT_PALETTES.tealMango[1],
  tealBright: COLOR_HUNT_PALETTES.tealMango[2],
  mango: COLOR_HUNT_PALETTES.tealMango[3],
  sea: COLOR_HUNT_PALETTES.seaCoral[0],
  sand: COLOR_HUNT_PALETTES.seaCoral[1],
  coral: COLOR_HUNT_PALETTES.seaCoral[2],
  linen: COLOR_HUNT_PALETTES.seaCoral[3],
  night: COLOR_HUNT_PALETTES.inkAqua[0],
  slate: COLOR_HUNT_PALETTES.inkAqua[1],
  aqua: COLOR_HUNT_PALETTES.inkAqua[2],
  mist: COLOR_HUNT_PALETTES.inkAqua[3],
  steel: COLOR_HUNT_PALETTES.parchment[0],
  parchment: COLOR_HUNT_PALETTES.parchment[1],
  taupe: COLOR_HUNT_PALETTES.parchment[2],
  clay: COLOR_HUNT_PALETTES.parchment[3],
  dusk: COLOR_HUNT_PALETTES.duskRose[0],
  mint: COLOR_HUNT_PALETTES.duskRose[1],
  snow: COLOR_HUNT_PALETTES.duskRose[2],
  rose: COLOR_HUNT_PALETTES.duskRose[3],
  blush: COLOR_HUNT_PALETTES.purpleBlush[0],
  lilac: COLOR_HUNT_PALETTES.purpleBlush[1],
  orchid: COLOR_HUNT_PALETTES.purpleBlush[2],
  violet: COLOR_HUNT_PALETTES.purpleBlush[3],
  peach: COLOR_HUNT_PALETTES.coralViolet[0],
  salmon: COLOR_HUNT_PALETTES.coralViolet[1],
  fuchsia: COLOR_HUNT_PALETTES.coralViolet[2],
  grape: COLOR_HUNT_PALETTES.coralViolet[3],
  royal: COLOR_HUNT_PALETTES.royalGold[0],
  plum: COLOR_HUNT_PALETTES.royalGold[1],
  harvest: COLOR_HUNT_PALETTES.royalGold[2],
  lemon: COLOR_HUNT_PALETTES.royalGold[3],
  nightViolet: COLOR_HUNT_PALETTES.violetBloom[0],
  magentaViolet: COLOR_HUNT_PALETTES.violetBloom[1],
  bloom: COLOR_HUNT_PALETTES.violetBloom[2],
  hotPink: COLOR_HUNT_PALETTES.violetBloom[3],
  skyBlue: COLOR_HUNT_PALETTES.aquaMint[0],
  aquaGlow: COLOR_HUNT_PALETTES.aquaMint[1],
  mintFoam: COLOR_HUNT_PALETTES.aquaMint[2],
  seafoam: COLOR_HUNT_PALETTES.aquaMint[3],
  leafIce: COLOR_HUNT_PALETTES.materialGreen[0],
  leafPowder: COLOR_HUNT_PALETTES.materialGreen[1],
  leaf: COLOR_HUNT_PALETTES.materialGreen[2],
  forest: COLOR_HUNT_PALETTES.materialGreen[3],
  pine: COLOR_HUNT_PALETTES.forestLime[0],
  moss: COLOR_HUNT_PALETTES.forestLime[1],
  chartreuse: COLOR_HUNT_PALETTES.forestLime[2],
  acid: COLOR_HUNT_PALETTES.forestLime[3],
  olive: COLOR_HUNT_PALETTES.oliveCitrus[0],
  lime: COLOR_HUNT_PALETTES.oliveCitrus[1],
  citrus: COLOR_HUNT_PALETTES.oliveCitrus[2],
  tangerine: COLOR_HUNT_PALETTES.oliveCitrus[3],
  spring: COLOR_HUNT_PALETTES.springLeaf[0],
  neonLeaf: COLOR_HUNT_PALETTES.springLeaf[1],
  meadow: COLOR_HUNT_PALETTES.springLeaf[2],
  canopy: COLOR_HUNT_PALETTES.springLeaf[3],
  honey: COLOR_HUNT_PALETTES.honeyToast[0],
  toast: COLOR_HUNT_PALETTES.honeyToast[1],
  caramel: COLOR_HUNT_PALETTES.honeyToast[2],
  rust: COLOR_HUNT_PALETTES.honeyToast[3],
  beige: COLOR_HUNT_PALETTES.mustardFlame[0],
  mustard: COLOR_HUNT_PALETTES.mustardFlame[1],
  blaze: COLOR_HUNT_PALETTES.mustardFlame[2],
  brick: COLOR_HUNT_PALETTES.mustardFlame[3],
  huntOrange: COLOR_HUNT_PALETTES.sunsetCoral[0],
  huntYellow: COLOR_HUNT_PALETTES.sunsetCoral[1],
  huntAmber: COLOR_HUNT_PALETTES.sunsetCoral[2],
  huntPink: COLOR_HUNT_PALETTES.sunsetCoral[3],
  sageSteel: COLOR_HUNT_PALETTES.sageGold[0],
  sageTan: COLOR_HUNT_PALETTES.sageGold[1],
  sageWheat: COLOR_HUNT_PALETTES.sageGold[2],
  sageCream: COLOR_HUNT_PALETTES.sageGold[3],
  signalYellow: COLOR_HUNT_PALETTES.trafficAmber[0],
  signalGold: COLOR_HUNT_PALETTES.trafficAmber[1],
  signalOrange: COLOR_HUNT_PALETTES.trafficAmber[2],
  signalFlame: COLOR_HUNT_PALETTES.trafficAmber[3],
  oak: COLOR_HUNT_PALETTES.harvestOak[0],
  bronze: COLOR_HUNT_PALETTES.harvestOak[1],
  harvestOrange: COLOR_HUNT_PALETTES.harvestOak[2],
  harvestCream: COLOR_HUNT_PALETTES.harvestOak[3],
} as const

/** Awaiting-review banner — Color Hunt #FEF2A0 #F3CD97 #E98B50 #BC4F4F */
export const AWAITING_REVIEW_PALETTE = {
  surface: "#FEF2A0",
  chip: "#F3CD97",
  accent: "#E98B50",
  ink: "#BC4F4F",
  text: "#4A2E0A",
} as const

/** Red brand themes — Color Hunt #FFDD9C #F9B637 #FB6C00 #E73F1E */
export const AWAITING_REVIEW_RED_PALETTE = {
  surface: "#FFDD9C",
  chip: "#F9B637",
  accent: "#FB6C00",
  ink: "#E73F1E",
  text: "#7F1D1D",
} as const

export type SolidListThumb = {
  fill: string
  icon: string
}

function thumb(fill: string, icon = "#FFFFFF"): SolidListThumb {
  return { fill, icon }
}

/** One Color Hunt palette for flashcard list chrome — coolGold. */
export const FLASHCARD_LIST = {
  gold: COLOR_HUNT_COOL.gold,
  indigo: COLOR_HUNT_COOL.indigo,
  cyan: COLOR_HUNT_COOL.cyan,
  sky: COLOR_HUNT_COOL.sky,
  ink: "#1E3A5F",
  white: "#FFFFFF",
} as const

/** Rotating list thumb cycle — cool + warm Color Hunt stops for palette variety. */
export const SOLID_THUMB_CYCLE: SolidListThumb[] = [
  thumb(COLOR_HUNT_COOL.indigo),
  thumb(COLOR_HUNT_COOL.cyan),
  thumb(COLOR_HUNT_COOL.gold, FLASHCARD_LIST.ink),
  thumb(COLOR_HUNT_COOL.sky, FLASHCARD_LIST.ink),
  thumb(COLOR_HUNT.orange),
  thumb(COLOR_HUNT.pink),
  thumb(COLOR_HUNT.amber, COLOR_HUNT.ink),
  thumb(COLOR_HUNT.yellow, COLOR_HUNT.ink),
]

export function solidListThumb(index: number): SolidListThumb {
  const slot = ((index % SOLID_THUMB_CYCLE.length) + SOLID_THUMB_CYCLE.length) % SOLID_THUMB_CYCLE.length
  return SOLID_THUMB_CYCLE[slot]!
}

export const STUDENT_CONTENT = {
  link: COLOR_HUNT_COOL.cyan,
} as const

/** Customize dashboard dialog + trigger — solid Color Hunt accents. */
export const STUDENT_CUSTOMIZE_THEME = {
  trigger: { fill: COLOR_HUNT_COOL.indigo, icon: "#FFFFFF" },
  header: { fill: COLOR_HUNT_COOL.indigo, icon: "#FFFFFF" },
  templateActive: {
    border: COLOR_HUNT_COOL.indigo,
    badgeFill: COLOR_HUNT_COOL.indigo,
    badgeText: "#FFFFFF",
    count: COLOR_HUNT_COOL.indigo,
  },
  widgetShown: { fill: COLOR_HUNT_COOL.cyan, text: "#FFFFFF" },
  widgetHidden: { fill: "#8E8E93", text: "#FFFFFF" },
  reset: { fill: COLOR_HUNT.orange, icon: "#FFFFFF" },
} as const

export const TIMELINE_STATUS_COLORS = {
  coming_soon: COLOR_HUNT.orange,
  open: "#22C55E",
  past_due: "#E73F1E",
  completed: "#64748B",
  syllabus: COLOR_HUNT_COOL.indigo,
} as const

/** Fixed per-metric swatches — each KPI uses a distinct Color Hunt hue. */
export const STUDENT_DASHBOARD_KPI_THUMBS = {
  overallGrade: { fill: COLOR_HUNT_COOL.indigo, icon: "#FFFFFF" },
  quizAverage: { fill: COLOR_HUNT_COOL.cyan, icon: "#FFFFFF" },
  homeworkAverage: { fill: COLOR_HUNT.pink, icon: "#FFFFFF" },
  attendance: { fill: COLOR_HUNT_COOL.sky, icon: "#1E3A5F" },
  missingWork: { fill: COLOR_HUNT.orange, icon: "#FFFFFF" },
  missingWorkClear: { fill: "#636366", icon: "#FFFFFF" },
  streak: { fill: COLOR_HUNT_COOL.gold, icon: COLOR_HUNT.ink },
  classroomPoints: { fill: COLOR_HUNT.amber, icon: COLOR_HUNT.ink },
  upcoming: { fill: COLOR_HUNT.yellow, icon: COLOR_HUNT.ink },
} as const satisfies Record<string, SolidListThumb>

export const FACULTY_DASHBOARD_KPI_THUMBS = {
  activeQuizzes: { fill: COLOR_HUNT_COOL.indigo, icon: "#FFFFFF" },
  students: { fill: COLOR_HUNT_COOL.cyan, icon: "#FFFFFF" },
  attempts: { fill: COLOR_HUNT.pink, icon: "#FFFFFF" },
  submissions: { fill: COLOR_HUNT_COOL.sky, icon: "#1E3A5F" },
  pendingIssues: { fill: COLOR_HUNT.orange, icon: "#FFFFFF" },
  pendingClear: { fill: "#636366", icon: "#FFFFFF" },
  upcoming: { fill: COLOR_HUNT.yellow, icon: COLOR_HUNT.ink },
  classAverage: { fill: "#66BB6A", icon: "#FFFFFF" },
  totalAssessments: { fill: "#325E6A", icon: "#FFFFFF" },
} as const satisfies Record<string, SolidListThumb>
