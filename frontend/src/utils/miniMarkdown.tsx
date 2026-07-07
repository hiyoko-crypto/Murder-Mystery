import type { ReactNode } from 'react'

// Small hand-rolled Markdown renderer for the memo tab — just enough syntax
// (headers, bold/italic, lists, blockquotes, links, code) for casual note
// formatting. Not a full CommonMark implementation on purpose: memo content
// is short, always the player's own text, and never needs to round-trip
// through anything stricter than "looks right when previewed."

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${i++}`
    if (match[1] !== undefined) {
      nodes.push(<a key={key} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a>)
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={key}>{match[3]}</strong>)
    } else if (match[4] !== undefined) {
      nodes.push(<strong key={key}>{match[4]}</strong>)
    } else if (match[5] !== undefined) {
      nodes.push(<em key={key}>{match[5]}</em>)
    } else if (match[6] !== undefined) {
      nodes.push(<em key={key}>{match[6]}</em>)
    } else if (match[7] !== undefined) {
      nodes.push(<code key={key}>{match[7]}</code>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

const HEADING_RE = /^(#{1,3})\s+(.*)/
const QUOTE_RE = /^>\s?/
const BULLET_RE = /^[-*]\s+/
const ORDERED_RE = /^\d+\.\s+/

export function renderMiniMarkdown(source: string): ReactNode {
  const lines = source.split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      const level = heading[1].length
      const key = blockKey++
      const content = renderInline(heading[2], `h${key}`)
      blocks.push(
        level === 1 ? <h1 key={key}>{content}</h1>
        : level === 2 ? <h2 key={key}>{content}</h2>
        : <h3 key={key}>{content}</h3>
      )
      i++
      continue
    }

    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].replace(QUOTE_RE, ''))
        i++
      }
      const key = blockKey++
      blocks.push(
        <blockquote key={key}>
          {quoteLines.map((l, idx) => (
            <span key={idx}>{renderInline(l, `q${key}-${idx}`)}{idx < quoteLines.length - 1 && <br />}</span>
          ))}
        </blockquote>
      )
      continue
    }

    if (BULLET_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && BULLET_RE.test(lines[i])) {
        items.push(lines[i].replace(BULLET_RE, ''))
        i++
      }
      const key = blockKey++
      blocks.push(
        <ul key={key}>
          {items.map((it, idx) => <li key={idx}>{renderInline(it, `ul${key}-${idx}`)}</li>)}
        </ul>
      )
      continue
    }

    if (ORDERED_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(lines[i].replace(ORDERED_RE, ''))
        i++
      }
      const key = blockKey++
      blocks.push(
        <ol key={key}>
          {items.map((it, idx) => <li key={idx}>{renderInline(it, `ol${key}-${idx}`)}</li>)}
        </ol>
      )
      continue
    }

    const paraLines: string[] = []
    while (
      i < lines.length && lines[i].trim() !== '' &&
      !HEADING_RE.test(lines[i]) && !QUOTE_RE.test(lines[i]) &&
      !BULLET_RE.test(lines[i]) && !ORDERED_RE.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    const key = blockKey++
    blocks.push(
      <p key={key}>
        {paraLines.map((l, idx) => (
          <span key={idx}>{renderInline(l, `p${key}-${idx}`)}{idx < paraLines.length - 1 && <br />}</span>
        ))}
      </p>
    )
  }

  return <>{blocks}</>
}
