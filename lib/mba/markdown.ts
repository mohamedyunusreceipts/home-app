// A deliberately tiny markdown subset for session summaries: ## / ### headings,
// paragraphs, "-"/"*" bullet lists and **bold**. It returns plain data that
// React renders as text nodes, so summary content can never inject HTML.

export type Block =
  | { type: 'h'; level: 2 | 3; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] = []

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'ul', items: list })
    list = []
  }

  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^[-*]\s+(.*)$/.exec(line)

    if (!line) {
      flushPara()
      flushList()
    } else if (heading) {
      flushPara()
      flushList()
      blocks.push({ type: 'h', level: heading[1]!.length === 3 ? 3 : 2, text: heading[2]! })
    } else if (bullet) {
      flushPara()
      list.push(bullet[1]!)
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return blocks
}

export interface Inline {
  text: string
  bold: boolean
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(/\*\*(.+?)\*\*/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false })
    out.push({ text: m[1]!, bold: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false })
  return out
}
