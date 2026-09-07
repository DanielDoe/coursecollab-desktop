import { decodeXmlEntities } from "@/lib/imscc/xml"

const FILEBASE = /\$IMS-CC-FILEBASE\$/g

export function rewriteImsccHtml(html: string): string {
  return html.replace(FILEBASE, "")
}

export function htmlToNoteBody(html: string): string {
  let text = rewriteImsccHtml(html)
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "")
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "")
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
  text = text.replace(/<li\b[^>]*>/gi, "- ")
  text = text.replace(/<h1\b[^>]*>/gi, "# ")
  text = text.replace(/<h2\b[^>]*>/gi, "## ")
  text = text.replace(/<h3\b[^>]*>/gi, "### ")
  text = text.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const inner = String(label).replace(/<[^>]+>/g, "").trim()
    return inner ? `[${inner}](${href})` : href
  })
  text = text.replace(/<[^>]+>/g, "")
  text = decodeXmlEntities(text)
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

export function extractHtmlBody(html: string): string {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return (body ? body[1] : html).trim()
}

export function fileExt(name: string): string {
  const base = name.split("/").pop() ?? name
  const i = base.lastIndexOf(".")
  return i >= 0 ? base.slice(i + 1).toLowerCase() : ""
}
