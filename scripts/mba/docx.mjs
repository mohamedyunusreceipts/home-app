// Minimal .docx reader: unzip word/document.xml and convert it to the summary
// markdown subset (## / ### headings, "- " bullets, **bold**, paragraphs),
// split into sections at each Heading 2. Dependency-free (node:zlib only).

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

/** Read one entry from a zip archive (stored or deflated). */
export function readZipEntry(buf, name) {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    if (buf.toString('utf8', p + 46, p + 46 + nameLen) === name) {
      const start = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28)
      const data = buf.subarray(start, start + compSize)
      return method === 0 ? data : inflateRawSync(data)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Paragraph XML → inline markdown text with **bold** runs. */
function paragraphText(xml) {
  let out = ''
  for (const run of xml.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? ''
    const bold = /<w:b(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(rPr)
    let text = ''
    for (const m of run.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
      text += m[1] !== undefined ? decode(m[1]) : m[0] === '<w:tab/>' ? ' ' : '\n'
    }
    if (!text) continue
    if (bold && text.trim()) {
      // Keep whitespace outside the markers so "**x**" stays well-formed.
      const lead = text.match(/^\s*/)[0]
      const trail = text.match(/\s*$/)[0]
      out += `${lead}**${text.trim()}**${trail}`
    } else {
      out += text
    }
  }
  // Merge adjacent bold runs ("**a****b**" → "**ab**").
  return out.replace(/\*\*\*\*/g, '').replace(/[ \t]+/g, ' ').trim()
}

/**
 * Convert a .docx into blocks, then group into sections keyed by each
 * Heading 2's text. Returns [{ heading, markdown }].
 */
export function docxSections(path) {
  const xmlBuf = readZipEntry(readFileSync(path), 'word/document.xml')
  if (!xmlBuf) throw new Error(`No document.xml in ${path}`)
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xmlBuf.toString('utf8'))?.[1] ?? ''

  const sections = []
  let current = null
  const push = (line) => current && current.lines.push(line)

  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const el = m[0]
    if (el.startsWith('<w:tbl>')) {
      for (const row of el.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
        const cells = (row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [])
          .map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(paragraphText).filter(Boolean).join(' '))
          .filter(Boolean)
        if (cells.length) push(`- ${cells.join(' — ')}`)
      }
      push('')
      continue
    }

    const style = /<w:pStyle w:val="([^"]+)"/.exec(el)?.[1] ?? ''
    const text = paragraphText(el)
    if (/^(Heading1|Title)$/i.test(style)) {
      current = null
      continue
    }
    if (/^Heading2$/i.test(style)) {
      current = { heading: text.replace(/\*\*/g, ''), lines: [] }
      sections.push(current)
      continue
    }
    if (!text) {
      push('')
      continue
    }
    // A short, wholly-bold paragraph ("**Key concepts**") is a de-facto subheading.
    const boldOnly = /^\*\*([^*]{1,80})\*\*:?$/.exec(text)
    if (/^Heading[3-6]$/i.test(style) || boldOnly) {
      push('')
      push(`### ${boldOnly ? boldOnly[1] : text.replace(/\*\*/g, '')}`)
    } else if (/<w:numPr>/.test(el) || /List/i.test(style)) {
      push(`- ${text}`)
    } else {
      push('')
      push(text)
      push('')
    }
  }

  return sections.map((s) => ({
    heading: s.heading,
    markdown: s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  }))
}

/**
 * Session key(s) a heading refers to:
 *   "Session 1 (Thu 8 Oct…)"   → "1"
 *   "Session 1.1 (likely…)"    → "1.1"
 *   "Sessions 5 and 6 (…)"     → "5-6"
 *   "Session 3: Variables…"    → "3"
 */
export function headingKey(heading) {
  const m = /^Sessions?\s+(\d+(?:\.\d+)?)(?:\s*(?:and|&|-|–|to)\s*(\d+(?:\.\d+)?))?/i.exec(heading.trim())
  if (!m) return null
  return m[2] ? `${m[1]}-${m[2]}` : m[1]
}

/** The topic part of a heading, after " - " or ": ". */
export function headingTopic(heading) {
  const m = /(?:\)\s*[-–:]\s*|:\s+|\s[-–]\s)(.+)$/.exec(heading)
  return (m?.[1] ?? heading).trim()
}
