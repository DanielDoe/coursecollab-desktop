export type ChatAttachment = {
  id: string
  name: string
  mimeType: string
  kind: "image" | "text"
  dataUrl?: string
  text?: string
  size: number
}

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_ATTACHMENTS = 5

const TEXT_FILE_PATTERN =
  /\.(txt|md|csv|json|cpp|c|cc|cxx|h|hpp|py|java|js|ts|tsx|jsx|html|css|xml|yaml|yml|tex|rtf|cs|go|rs|sql|sh|bat)$/i

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

function isTextLikeFile(file: File): boolean {
  return file.type.startsWith("text/") || TEXT_FILE_PATTERN.test(file.name)
}

export async function processChatFiles(files: File[]): Promise<ChatAttachment[]> {
  const results: ChatAttachment[] = []

  for (const file of files) {
    if (results.length >= MAX_ATTACHMENTS) break
    if (file.size > MAX_FILE_BYTES) continue

    if (file.type.startsWith("image/")) {
      const dataUrl = await readAsDataUrl(file)
      if (!dataUrl.startsWith("data:image/")) continue
      results.push({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        kind: "image",
        dataUrl,
        size: file.size,
      })
      continue
    }

    if (isTextLikeFile(file)) {
      const text = (await file.text()).slice(0, 50_000)
      results.push({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type || "text/plain",
        kind: "text",
        text,
        size: file.size,
      })
    }
  }

  return results
}

export function buildAttachmentContext(attachments: ChatAttachment[]): string {
  let block = ""
  for (const att of attachments) {
    if (att.kind === "text" && att.text) {
      block += `\n\n--- ${att.name} ---\n${att.text}\n---`
    } else if (att.kind === "image") {
      block += `\n\n[Attached image: ${att.name}]`
    }
  }
  return block
}

export function imageAttachmentsForApi(
  attachments: ChatAttachment[],
): Array<{ name: string; mimeType: string; dataUrl: string }> {
  return attachments
    .filter((a) => a.kind === "image" && a.dataUrl?.startsWith("data:image/"))
    .map((a) => ({ name: a.name, mimeType: a.mimeType, dataUrl: a.dataUrl! }))
}
