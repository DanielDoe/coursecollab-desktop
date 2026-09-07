export const ECE2202_CH4_OPAMP_SOLUTIONS_UPLOAD_TITLE =
  "Ch. 4 op-amp worked solutions — use this handout for Classroom Points exercises"

export function ece2202Ch4OpampSolutionsAnnouncementHtml(): string {
  return `<p><strong>ECE 2202 students — attached is a step-by-step solution handout for our Chapter 4 op-amp Classroom Points exercises and selected textbook problems.</strong></p>
<p>Use it while you prepare your own submissions in <strong>Classroom Points</strong>. Show your work in your upload; this PDF is a reference to check method and final answers.</p>
<p><strong>Classroom Points exercises covered:</strong></p>
<ul>
<li>Exercise — Ideal Op-Amp Circuit Analysis</li>
<li>Exercise — Inverting Amplifier Circuit Analysis</li>
<li>Exercise — Summing Amplifier Circuit Analysis</li>
</ul>
<p><strong>Textbook problems also included:</strong> 4.9, 4.10, 4.13, 4.15, 4.23, 4.36, and 4.38.</p>
<p>The PDF uses <strong>v<sub>p</sub></strong> and <strong>v<sub>n</sub></strong> notation throughout. Tap <strong>Preview</strong> or <strong>Download</strong> on the attachment below.</p>
<p>Questions? Reply on this announcement or ask during class.</p>`
}

export function ece2202Ch4OpampSolutionsPlainPreview(maxLen = 150): string {
  const plain =
    "ECE 2202: step-by-step Ch. 4 op-amp solution handout for Classroom Points exercises (ideal, inverting, and summing amplifiers) plus problems 4.9–4.38. Download the attached PDF."
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 3)}...` : plain
}
