import { execFile } from "node:child_process"
import { promisify } from "node:util"
import fs from "node:fs"
import path from "node:path"

const execFileAsync = promisify(execFile)

export type OfficeToPdfResult =
  | { ok: true; pdfPath: string }
  | { ok: false; reason: string }

function resolveSofficePath(): string | null {
  const envPath = process.env.LIBREOFFICE_PATH?.trim()
  if (envPath && fs.existsSync(envPath)) return envPath

  const winCandidates = [
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ]
  for (const p of winCandidates) {
    if (fs.existsSync(p)) return p
  }

  return "soffice"
}

/**
 * Converts .ppt / .pptx (or other LO-supported formats) to PDF via LibreOffice headless.
 * Requires LibreOffice installed on the server, or LIBREOFFICE_PATH pointing to soffice.
 */
export async function convertOfficeFileToPdf(
  inputPath: string,
  outputDir: string,
): Promise<OfficeToPdfResult> {
  const soffice = resolveSofficePath()
  if (!soffice) {
    return { ok: false, reason: "LibreOffice not configured (set LIBREOFFICE_PATH or install LibreOffice)" }
  }

  try {
    await fs.promises.mkdir(outputDir, { recursive: true })
  } catch {
    return { ok: false, reason: "Could not create output directory" }
  }

  try {
    await execFileAsync(
      soffice,
      [
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        outputDir,
        inputPath,
      ],
      { timeout: 180_000, windowsHide: true },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LibreOffice conversion failed"
    return { ok: false, reason: msg }
  }

  const base = path.basename(inputPath, path.extname(inputPath))
  const pdfPath = path.join(outputDir, `${base}.pdf`)
  if (!fs.existsSync(pdfPath)) {
    return { ok: false, reason: "Conversion produced no PDF (is LibreOffice installed?)" }
  }

  return { ok: true, pdfPath }
}
