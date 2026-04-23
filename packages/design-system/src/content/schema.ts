/**
 * Structured rich-content JSON schema. Tiptap / ProseMirror-compatible.
 * Editor choice (Tiptap / Lexical / BlockNote) is implementation detail;
 * the serialized document must conform to this shape.
 */

export type TextMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'link'; attrs: { href: string } }

export type TextNode = {
  type: 'text'
  text: string
  marks?: TextMark[]
}

export type ParagraphNode = {
  type: 'paragraph'
  content?: InlineNode[]
}

export type HeadingNode = {
  type: 'heading'
  attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 }
  content?: InlineNode[]
}

export type BulletListNode = { type: 'bulletList'; content?: ListItemNode[] }
export type OrderedListNode = { type: 'orderedList'; content?: ListItemNode[] }
export type ListItemNode = { type: 'listItem'; content?: BlockNode[] }

export type BlockquoteNode = { type: 'blockquote'; content?: BlockNode[] }

export type ImageNode = {
  type: 'image'
  attrs: { src: string; alt?: string; title?: string }
}

export type HorizontalRuleNode = { type: 'horizontalRule' }

export type InlineNode = TextNode
export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | ImageNode
  | HorizontalRuleNode

export type RichContent = {
  type: 'doc'
  content: BlockNode[]
}

export function isRichContent(value: unknown): value is RichContent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.type === 'doc' && Array.isArray(v.content)
}
