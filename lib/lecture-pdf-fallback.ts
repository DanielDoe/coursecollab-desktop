/**
 * Git-committed public PDF paths for ECE 2202 lectures.
 * Used when lectures.pdf_url points at blob/local paths missing after a cross-machine deploy.
 */
export const ECE2202_LECTURE_PDF_FALLBACKS: Record<number, string> = {
  65: "/uploads/lecture-documents/65/Circuit-Analysis-Design-II-Ch1-1780008829428.pdf",
  66: "/uploads/lecture-documents/66/Circuit-Analysis-Design-II-Ch2-1780014895751.pdf",
  67: "/uploads/lecture-documents/67/Circuit-Analysis-Design-II-Ch3-1780672643296.pdf",
  68: "/uploads/lecture-documents/68/Circuit-Analysis-Design-II-Ch4-1781561045506.pdf",
  70: "/uploads/lecture-documents/70/Circuit-Analysis-Design-II-Ch5.pdf",
  71: "/uploads/lecture-documents/71/Circuit-Analysis-Design-II-Ch6.pdf",
  73: "/uploads/lecture-documents/73/ECE2202-Lecture8-AC-Power.pdf",
}

export function getLecturePdfPublicFallback(lectureId: number): string | null {
  return ECE2202_LECTURE_PDF_FALLBACKS[lectureId] ?? ELEG130X_LECTURE_PDF_FALLBACKS[lectureId] ?? null
}

/** Git-committed public PDF paths for ELEG 130X lectures (rebuild-eleg130x-lectures). */
export const ELEG130X_LECTURE_PDF_FALLBACKS: Record<number, string> = {
  254: "/eleg130x/lectures/254/ELEG-130X-Course-Introduction.pdf",
  255: "/eleg130x/lectures/255/ELEG-130X-Introduction-to-Programming-Concepts.pdf",
  256: "/eleg130x/lectures/256/ELEG-130X-First-Program.pdf",
  257: "/eleg130x/lectures/257/ELEG-130X-Modular-Programming-and-C++-Basics.pdf",
  258: "/eleg130x/lectures/258/ELEG-130X-Selection-Criteria.pdf",
  259: "/eleg130x/lectures/259/ELEG-130X-Functions.pdf",
}
