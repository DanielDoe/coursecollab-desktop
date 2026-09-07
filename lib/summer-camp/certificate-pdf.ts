import { GState, jsPDF } from "jspdf"
import QRCode from "qrcode"
import type { CampCertificateRenderData, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import {
  CERTIFICATE_EDGE_PAD_MM,
  CERTIFICATE_FOOTER_H_MM,
  CERTIFICATE_SEAL_SIZE_MM,
  CERTIFICATE_SEAL_URL,
  CERTIFICATE_SIDE_PAD_MM,
  CERTIFICATE_SIG_FOOTER_GAP_MM,
  CERTIFICATE_SIG_LINE_HALF_WIDTH_MM,
  CERTIFICATE_SIG_SPREAD_MM,
  CERTIFICATE_PDF_FOOTER_LABEL_PT,
  CERTIFICATE_PDF_FOOTER_VALUE_PT,
  CERTIFICATE_PDF_SIG_DETAIL_PT,
  CERTIFICATE_PDF_SIG_IMAGE_H_MM,
  CERTIFICATE_PDF_SIG_NAME_PT,
  CERTIFICATE_SEAL_LINE_OFFSET_MM,
  CERTIFICATE_SIG_TEXT_H_MM,
  CERTIFICATE_SIG_ZONE_H_MM,
  CERTIFICATE_WATERMARK_PDF_OPACITY,
  collegeHeaderLines,
  departmentHeaderLines,
  enabledSignatories,
  formatCertificateFooterDate,
  isBlockEnabled,
  resolveSignatureScale,
  resolveSignatureOffsetY,
} from "@/lib/summer-camp/certificate-template-utils"
import {
  fitImageToBoxMm,
  loadPublicImageDataUrl,
  pdfFlattenedImagePath,
} from "@/lib/recommendation-letterhead-images"

const PURPLE: [number, number, number] = [88, 44, 131]
const GOLD: [number, number, number] = [196, 160, 82]
const INK: [number, number, number] = [45, 45, 55]
const MUTED: [number, number, number] = [110, 110, 120]
const BODY_MUTED: [number, number, number] = [75, 75, 88]
const CREAM: [number, number, number] = [252, 250, 246]

/** US Letter landscape — 11 × 8.5 in */
const PAGE_W = 279.4
const PAGE_H = 215.9
const MARGIN = 14

async function loadOptionalImage(url: string | null | undefined) {
  if (!url?.trim()) return null
  const raw = url.startsWith("/") ? url : `/${url.replace(/^\//, "")}`
  const path = raw.toLowerCase().endsWith(".webp") ? raw.replace(/\.webp$/i, ".png") : raw

  const flatPath = pdfFlattenedImagePath(path)
  if (flatPath) {
    const flat = await loadPublicImageDataUrl(flatPath)
    if (flat) return flat
  }

  if (raw.toLowerCase().endsWith(".webp")) {
    return loadPublicImageDataUrl(path)
  }

  return loadPublicImageDataUrl(path)
}

function drawBorder(pdf: jsPDF) {
  pdf.setDrawColor(...PURPLE)
  pdf.setLineWidth(0.35)
  pdf.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, PAGE_H - MARGIN * 2)
  pdf.setDrawColor(...GOLD)
  pdf.setLineWidth(0.2)
  pdf.rect(MARGIN + 2, MARGIN + 2, PAGE_W - (MARGIN + 2) * 2, PAGE_H - (MARGIN + 2) * 2)

  const corner = 7
  const inset = MARGIN + 2
  pdf.setDrawColor(...GOLD)
  pdf.setLineWidth(0.35)
  // top-left
  pdf.line(inset, inset, inset + corner, inset)
  pdf.line(inset, inset, inset, inset + corner)
  // top-right
  pdf.line(PAGE_W - inset, inset, PAGE_W - inset - corner, inset)
  pdf.line(PAGE_W - inset, inset, PAGE_W - inset, inset + corner)
  // bottom-left
  pdf.line(inset, PAGE_H - inset, inset + corner, PAGE_H - inset)
  pdf.line(inset, PAGE_H - inset, inset, PAGE_H - inset - corner)
  // bottom-right
  pdf.line(PAGE_W - inset, PAGE_H - inset, PAGE_W - inset - corner, PAGE_H - inset)
  pdf.line(PAGE_W - inset, PAGE_H - inset, PAGE_W - inset, PAGE_H - inset - corner)
}

export async function generateCampCertificatePdf(
  template: CampCertificateTemplate,
  data: CampCertificateRenderData,
): Promise<Buffer> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [PAGE_W, PAGE_H] })
  const cx = PAGE_W / 2

  pdf.setFillColor(...CREAM)
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F")

  const innerInset = MARGIN + 2
  const contentW = PAGE_W - innerInset * 2

  if (isBlockEnabled(template, "watermark")) {
    const wmUrl = template.assets.watermarkImageUrl?.trim() || "/summer-camp/certificate-watermark.png"
    const wm = await loadOptionalImage(wmUrl)
    if (wm && (wm.format === "PNG" || wm.format === "JPEG")) {
      const wmMaxW = contentW * 0.36
      const wmMaxH = PAGE_H - innerInset * 2 - CERTIFICATE_EDGE_PAD_MM * 2 - 8
      const box = fitImageToBoxMm(wm.widthPx, wm.heightPx, wmMaxW, wmMaxH)
      const wmX = PAGE_W - innerInset - CERTIFICATE_SIDE_PAD_MM - box.widthMm
      const wmY = PAGE_H - innerInset - CERTIFICATE_EDGE_PAD_MM - box.heightMm
      pdf.setGState(new GState({ opacity: CERTIFICATE_WATERMARK_PDF_OPACITY }))
      pdf.addImage(wm.dataUrl, wm.format, wmX, wmY, box.widthMm, box.heightMm)
      pdf.setGState(new GState({ opacity: 1 }))
    }
  }

  if (isBlockEnabled(template, "border")) drawBorder(pdf)

  const colW = contentW / 3
  const col1Cx = innerInset + colW / 2
  const col2Cx = innerInset + colW + colW / 2
  const col3Cx = innerInset + colW * 2 + colW / 2
  const col2Div = innerInset + colW
  const col3Div = innerInset + colW * 2

  let y = innerInset + CERTIFICATE_EDGE_PAD_MM

  if (isBlockEnabled(template, "header")) {
    const logoL = await loadOptionalImage(template.assets.pvamuLogoUrl)
    const logoR = await loadOptionalImage(template.assets.creditLogoUrl)
    const headerTop = y
    const headerH = 18
    const col1X = innerInset + CERTIFICATE_SIDE_PAD_MM
    const col3X = innerInset + colW * 2

    if (logoL && (logoL.format === "PNG" || logoL.format === "JPEG")) {
      const box = fitImageToBoxMm(logoL.widthPx, logoL.heightPx, colW - 10, headerH - 2)
      pdf.addImage(logoL.dataUrl, logoL.format, col1X, headerTop + 1, box.widthMm, box.heightMm)
    } else if (template.universityLine.trim()) {
      pdf.setFont("times", "bold")
      pdf.setFontSize(8.5)
      pdf.setTextColor(...PURPLE)
      pdf.text(template.universityLine, col1X, headerTop + 8)
    }

    const centerLeft = col2Div + CERTIFICATE_SIDE_PAD_MM
    const [collegePrimary, collegeSecondary] = collegeHeaderLines(template)
    const [deptPrimary, deptSecondary] = departmentHeaderLines(template)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.setTextColor(...PURPLE)
    pdf.text(collegePrimary.toUpperCase(), centerLeft, headerTop + 3.5)
    if (collegeSecondary) {
      pdf.text(collegeSecondary.toUpperCase(), centerLeft, headerTop + 7.5)
    }
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.8)
    pdf.setTextColor(...PURPLE)
    pdf.text(deptPrimary, centerLeft, headerTop + 11.5)
    if (deptSecondary) {
      pdf.text(deptSecondary, centerLeft, headerTop + 15)
    }

    const rightInnerX = col3X + CERTIFICATE_SIDE_PAD_MM
    const rightInnerW = colW - CERTIFICATE_SIDE_PAD_MM * 2
    if (logoR && (logoR.format === "PNG" || logoR.format === "JPEG")) {
      const box = fitImageToBoxMm(logoR.widthPx, logoR.heightPx, rightInnerW, headerH - 2)
      const logoRX = rightInnerX + rightInnerW - box.widthMm
      pdf.addImage(logoR.dataUrl, logoR.format, logoRX, headerTop + 1, box.widthMm, box.heightMm)
    } else {
      if (template.creditCenterLine.trim()) {
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(6.5)
        pdf.setTextColor(...PURPLE)
        pdf.text(template.creditCenterLine, rightInnerX + rightInnerW, headerTop + 4, { align: "right" })
      }
      if (template.creditCenterSubtitle.trim()) {
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(5)
        pdf.setTextColor(...MUTED)
        const creditSub = pdf.splitTextToSize(template.creditCenterSubtitle, rightInnerW)
        pdf.text(creditSub, rightInnerX + rightInnerW, headerTop + 8.5, { align: "right" })
      }
    }

    pdf.setDrawColor(175, 155, 195)
    pdf.setLineWidth(0.25)
    pdf.line(col2Div, headerTop, col2Div, headerTop + headerH + 1)
    pdf.line(col3Div, headerTop, col3Div, headerTop + headerH + 1)

    y = headerTop + headerH + 8
  }

  if (isBlockEnabled(template, "certificateTitle")) {
    const titleScale = template.typography.titleScale ?? 1
    pdf.setFont("times", "normal")
    pdf.setFontSize(28 * titleScale)
    pdf.setTextColor(...PURPLE)
    const title = template.certificateTitle.toUpperCase()
    pdf.text(title, cx, y, { align: "center" })

    y += 10
    pdf.setFontSize(11 * titleScale)
    pdf.setTextColor(...GOLD)
    pdf.text(template.certificateSubtitle.toUpperCase(), cx, y, { align: "center" })

    pdf.setDrawColor(...GOLD)
    pdf.setLineWidth(0.25)
    const lineW = 42
    pdf.line(cx - lineW - 8, y + 2, cx - 8, y + 2)
    pdf.line(cx + 8, y + 2, cx + lineW + 8, y + 2)
    y += 14
  }

  if (isBlockEnabled(template, "presentedTo")) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text(template.presentedToLabel.toUpperCase(), cx, y, { align: "center" })
    y += 12

    const nameScale = template.typography.nameScale ?? 1
    pdf.setFont("times", "bold")
    pdf.setFontSize(34 * nameScale)
    pdf.setTextColor(...PURPLE)
    pdf.text(data.studentName.toUpperCase(), cx, y, { align: "center" })
    y += 8
    pdf.setFillColor(...GOLD)
    const d = 1.1
    pdf.lines(
      [[d, 0], [0, d], [-d, 0], [0, -d]],
      cx - d,
      y,
      [1, 1],
      "F",
      true,
    )
    y += 12
  }

  if (isBlockEnabled(template, "completionStatement")) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7.5)
    pdf.setTextColor(...MUTED)
    pdf.text(template.completionLeadIn.toUpperCase(), cx, y, { align: "center" })
    y += 9
    pdf.setFont("times", "bold")
    pdf.setFontSize(13)
    pdf.setTextColor(...PURPLE)
    pdf.text(data.trainingName.toUpperCase(), cx, y, { align: "center", maxWidth: PAGE_W - 50 })
    y += 10
  }

  if (isBlockEnabled(template, "programLine") && template.programLine.trim()) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(...MUTED)
    pdf.text("AS PART OF THE", cx, y, { align: "center" })
    y += 7
    pdf.setFont("times", "bolditalic")
    pdf.setFontSize(10)
    pdf.setTextColor(...INK)
    pdf.text(template.programLine, cx, y, { align: "center", maxWidth: PAGE_W - 60 })
    y += 8
  }

  const footerBottom = PAGE_H - innerInset - CERTIFICATE_EDGE_PAD_MM
  const footerH = CERTIFICATE_FOOTER_H_MM
  const footerTop = footerBottom - footerH
  const sigZoneBottom = footerTop - CERTIFICATE_SIG_FOOTER_GAP_MM
  const sigZoneTop = sigZoneBottom - CERTIFICATE_SIG_ZONE_H_MM
  const sigLineY = sigZoneBottom - CERTIFICATE_SIG_TEXT_H_MM
  const signatureScale = resolveSignatureScale(template)
  const signatureOffsetY = resolveSignatureOffsetY(template)
  const sigImageH = CERTIFICATE_PDF_SIG_IMAGE_H_MM * signatureScale
  const sigLineHalf = CERTIFICATE_SIG_LINE_HALF_WIDTH_MM
  const sigImageTop = sigLineY - sigImageH - 3 + signatureOffsetY
  const footerValueY = footerTop + footerH * 0.36
  const footerLabelY = footerTop + footerH * 0.7
  const sigNameGap = 4.2
  const sigDetailGap = 3.4

  const drawSeal = async (sealCenterY: number) => {
    const sealUrl = template.assets.sealImageUrl?.trim() || CERTIFICATE_SEAL_URL
    const seal = await loadOptionalImage(sealUrl)
    if (seal && (seal.format === "PNG" || seal.format === "JPEG")) {
      const box = fitImageToBoxMm(
        seal.widthPx,
        seal.heightPx,
        CERTIFICATE_SEAL_SIZE_MM,
        CERTIFICATE_SEAL_SIZE_MM,
      )
      pdf.addImage(
        seal.dataUrl,
        seal.format,
        cx - box.widthMm / 2,
        sealCenterY - box.heightMm / 2,
        box.widthMm,
        box.heightMm,
      )
    }
  }

  if (isBlockEnabled(template, "signatures")) {
    const sigs = enabledSignatories(template)
    const spread = CERTIFICATE_SIG_SPREAD_MM
    const positions = sigs.length === 1 ? [cx] : [cx - spread, cx + spread]
    // Preview: seal `bottom-4` — anchored on the signature line, behind signatory text.
    const sealCenterY = sigLineY + CERTIFICATE_SEAL_LINE_OFFSET_MM

    if (isBlockEnabled(template, "seal")) {
      await drawSeal(sealCenterY)
    }

    for (let i = 0; i < sigs.length; i++) {
      const sig = sigs[i]
      const x = positions[i] ?? cx
      const img = await loadOptionalImage(sig.signatureImageUrl)
      if (img && (img.format === "PNG" || img.format === "JPEG")) {
        const box = fitImageToBoxMm(
          img.widthPx,
          img.heightPx,
          sigLineHalf * 1.6 * signatureScale,
          sigImageH,
        )
        pdf.addImage(
          img.dataUrl,
          img.format,
          x - box.widthMm / 2,
          sigImageTop + (sigImageH - box.heightMm),
          box.widthMm,
          box.heightMm,
        )
      }

      pdf.setDrawColor(120, 120, 130)
      pdf.setLineWidth(0.2)
      pdf.line(x - sigLineHalf, sigLineY, x + sigLineHalf, sigLineY)

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(CERTIFICATE_PDF_SIG_NAME_PT)
      pdf.setTextColor(...PURPLE)
      pdf.text(sig.name.toUpperCase(), x, sigLineY + sigNameGap, { align: "center", maxWidth: 50 })

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(CERTIFICATE_PDF_SIG_DETAIL_PT)
      pdf.setTextColor(...BODY_MUTED)
      const detailLines = [sig.title, sig.department, sig.organization].filter(Boolean).slice(0, 3)
      let ly = sigLineY + sigNameGap + 3.6
      for (const line of detailLines) {
        pdf.text(line, x, ly, { align: "center", maxWidth: 50 })
        ly += sigDetailGap
      }
    }
  } else if (isBlockEnabled(template, "seal")) {
    await drawSeal(sigZoneTop + CERTIFICATE_SIG_ZONE_H_MM / 2)
  }

  if (isBlockEnabled(template, "footer") || isBlockEnabled(template, "qrCode")) {
    pdf.setDrawColor(175, 155, 195)
    pdf.setLineWidth(0.2)
    pdf.line(col2Div, footerTop, col2Div, footerBottom)
    pdf.line(col3Div, footerTop, col3Div, footerBottom)

    if (isBlockEnabled(template, "footer")) {
      const dateStr = formatCertificateFooterDate(data.issuedAt)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(CERTIFICATE_PDF_FOOTER_VALUE_PT)
      pdf.setTextColor(...INK)
      pdf.text(dateStr, col1Cx, footerValueY, { align: "center" })
      pdf.setFontSize(CERTIFICATE_PDF_FOOTER_LABEL_PT)
      pdf.setTextColor(...BODY_MUTED)
      pdf.text("DATE", col1Cx, footerLabelY, { align: "center" })

      pdf.setFontSize(CERTIFICATE_PDF_FOOTER_VALUE_PT)
      pdf.setTextColor(...INK)
      pdf.text(data.certificateNumber, col2Cx, footerValueY, { align: "center" })
      pdf.setFontSize(CERTIFICATE_PDF_FOOTER_LABEL_PT)
      pdf.setTextColor(...BODY_MUTED)
      pdf.text("CERTIFICATE ID", col2Cx, footerLabelY, { align: "center" })
    }

    if (isBlockEnabled(template, "qrCode")) {
      const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
        margin: 0,
        width: 120,
        color: { dark: "#582c83", light: "#00000000" },
      })
      const qrSize = 12
      const qrY = footerTop + (footerH - qrSize) / 2
      pdf.addImage(qrDataUrl, "PNG", col3Cx - qrSize / 2, qrY, qrSize, qrSize)
    }
  }

  return Buffer.from(pdf.output("arraybuffer"))
}

/** @deprecated Use generateCampCertificatePdf with template */
export type CampCertificateData = CampCertificateRenderData
