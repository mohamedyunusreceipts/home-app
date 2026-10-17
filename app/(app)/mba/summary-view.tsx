import { parseInline, parseMarkdown } from '@/lib/mba/markdown'

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((seg, i) =>
        seg.bold ? (
          <strong key={i} className="font-semibold text-terracotta-900">
            {seg.text}
          </strong>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

/** Renders the summary markdown subset as plain React text — never raw HTML. */
export function SummaryView({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-2.5 text-[14.5px] leading-relaxed text-[#4A372D]">
      {parseMarkdown(markdown).map((b, i) => {
        if (b.type === 'h') {
          return b.level === 2 ? (
            <h3 key={i} className="pt-2 font-serif text-[18px] font-semibold text-terracotta-900">
              <Inline text={b.text} />
            </h3>
          ) : (
            <h4 key={i} className="pt-1 text-[14px] font-bold text-terracotta-800">
              <Inline text={b.text} />
            </h4>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-terracotta-300">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        )
      })}
    </div>
  )
}
