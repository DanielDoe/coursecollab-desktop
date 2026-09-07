export function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function tagRe(tag: string, flags = "i"): RegExp {
  return new RegExp(`<(?:[\\w.-]+:)?${tag}\\b([^>]*)>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}\\s*>`, flags)
}

export function xmlAttr(openOrBlock: string, name: string): string | null {
  const m = openOrBlock.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"))
    ?? openOrBlock.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"))
  return m ? decodeXmlEntities(m[1]) : null
}

export function xmlText(xml: string, tag: string): string | null {
  const m = xml.match(tagRe(tag))
  if (!m) return null
  return decodeXmlEntities(m[2].trim())
}

export function xmlInner(xml: string, tag: string): string | null {
  const m = xml.match(tagRe(tag))
  return m ? m[2] : null
}

export function xmlBlocks(xml: string, tag: string): string[] {
  const re = tagRe(tag, "gi")
  return xml.match(re) ?? []
}

export function xmlFirst(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    const value = xmlText(xml, tag)
    if (value) return value
  }
  return null
}
