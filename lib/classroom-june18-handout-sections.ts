/**
 * Canonical June 18, 2026 classroom-points handout sections (LaTeX/PDF + per-section PNG exports).
 * Keep in sync with docs/ece2202-classroom-june18/ece2202-classroom-points-june18.tex
 */
export type ClassroomJune18HandoutSection = {
  /** Pandoc HTML h1 id — verified after build */
  sectionId: string
  /** Short label for logs / problem list */
  title: string
  /** Paths under docs/ece2202-classroom-june18/ */
  figures: Array<{
    relPath: string
    /** Copy from public/ or scripts/ when missing in docs/figures */
    fallbacks?: string[]
  }>
}

export const CLASSROOM_JUNE18_HANDOUT_SECTIONS: ClassroomJune18HandoutSection[] = [
  {
    sectionId: "thévenin-theorem-terminals-ab",
    title: "Thévenin Theorem (terminals a–b)",
    figures: [{ relPath: "figures/e3-thevenin-original-circuit.png" }],
  },
  {
    sectionId: "exercise-3-10-nodal-analysis-fig.-p3.10-i_x",
    title: "Exercise 3-10 — Nodal Analysis (Fig. P3.10)",
    figures: [
      {
        relPath: "figures/e3-10-p310-nodal.png",
        fallbacks: [
          "figures/e3-10-superposition.png",
          "scripts/data/figures/textbook-extracted/Figure_P3-10.png",
          "figures/e3-10-superposition.jpg",
          "public/ece2202/classroom-submissions/e3-10-p310-nodal.png",
        ],
      },
    ],
  },
  {
    sectionId: "exercise-3-10-superposition-v_mathrmout-fig.-e3.10",
    title: "Exercise 3-10 — Superposition (V_out, Fig. E3.10)",
    figures: [
      {
        relPath: "figures/e3-10-vout-superposition.png",
        fallbacks: ["public/ece2202/classroom-submissions/e3-10-vout-superposition.png"],
      },
    ],
  },
  {
    sectionId: "nortons-theorem-terminals-ab",
    title: "Norton's Theorem (terminals a–b)",
    figures: [],
  },
  {
    sectionId: "exercise-3-12-thévenin-equivalent-and-current-i",
    title: "Exercise 3-12 — Thévenin Equivalent and Current I",
    figures: [{ relPath: "figures/e3-12-thevenin.png" }],
  },
  {
    sectionId: "exercise-3-13-norton-equivalent",
    title: "Exercise 3-13 — Norton Equivalent",
    figures: [{ relPath: "figures/e3-13-norton.png" }],
  },
]
