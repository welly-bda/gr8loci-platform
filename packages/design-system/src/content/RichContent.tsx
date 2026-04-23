import { Fragment } from 'react'
import type { ReactNode } from 'react'
import styles from './RichContent.module.css'
import type {
  BlockNode,
  InlineNode,
  RichContent as RichContentDoc,
  TextMark,
  TextNode,
} from './schema'

export interface RichContentProps {
  doc: RichContentDoc
}

export function RichContent({ doc }: RichContentProps) {
  return (
    <div className={styles.content}>
      {doc.content.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  )
}

function renderBlock(node: BlockNode): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p>{(node.content ?? []).map((child, i) => renderInline(child, i))}</p>
    case 'heading': {
      const Tag = `h${node.attrs.level}` as const
      return <Tag>{(node.content ?? []).map((child, i) => renderInline(child, i))}</Tag>
    }
    case 'bulletList':
      return (
        <ul>
          {(node.content ?? []).map((li, i) => (
            <Fragment key={i}>{renderBlock(li)}</Fragment>
          ))}
        </ul>
      )
    case 'orderedList':
      return (
        <ol>
          {(node.content ?? []).map((li, i) => (
            <Fragment key={i}>{renderBlock(li)}</Fragment>
          ))}
        </ol>
      )
    case 'listItem':
      return (
        <li>
          {(node.content ?? []).map((child, i) => (
            <Fragment key={i}>{renderBlock(child)}</Fragment>
          ))}
        </li>
      )
    case 'blockquote':
      return (
        <blockquote>
          {(node.content ?? []).map((child, i) => (
            <Fragment key={i}>{renderBlock(child)}</Fragment>
          ))}
        </blockquote>
      )
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={node.attrs.src} alt={node.attrs.alt ?? ''} title={node.attrs.title} />
    case 'horizontalRule':
      return <hr />
  }
}

function renderInline(node: InlineNode, i: number): ReactNode {
  if (node.type === 'text') return <Fragment key={i}>{applyMarks(node)}</Fragment>
  return null
}

function applyMarks(node: TextNode): ReactNode {
  let content: ReactNode = node.text
  for (const mark of node.marks ?? []) {
    content = wrapMark(mark, content)
  }
  return content
}

function wrapMark(mark: TextMark, inner: ReactNode): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong>{inner}</strong>
    case 'italic':
      return <em>{inner}</em>
    case 'link':
      return <a href={mark.attrs.href}>{inner}</a>
  }
}
