// lib/tiptap/extensions.ts
import { Node, mergeAttributes } from '@tiptap/core'
import ImageExt from '@tiptap/extension-image'

/* ------------------------------------------------------------------ */
/*  ①  Pull‑quote (pure server version)                               */
/* ------------------------------------------------------------------ */
export const PullQuote = Node.create({
  name: 'pullQuote',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return { alignment: { default: 'left' } }
  },
  parseHTML() {
    return [{ tag: 'blockquote.pull-quote' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'blockquote',
      mergeAttributes(HTMLAttributes, {
        class: `pull-quote ${HTMLAttributes.alignment}`,
      }),
      0,
    ]
  },
})

/* ------------------------------------------------------------------ */
/*  ②  Callout                                                        */
/* ------------------------------------------------------------------ */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  addAttributes() {
    return { type: { default: 'info' } }
  },
  parseHTML() {
    return [{ tag: 'div.callout' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `callout ${HTMLAttributes.type}`,
      }),
      0,
    ]
  },
})

/* ------------------------------------------------------------------ */
/*  ③  Math nodes – server version only needs renderHTML              */
/* ------------------------------------------------------------------ */
import katex from 'katex'

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { latex: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-type=math-block]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' }),
      katex.renderToString(
        node.attrs.latex || node.textContent,
        { throwOnError: false }
      ),
    ]
  },
})

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-type=math-inline]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'math-inline' }),
      katex.renderToString(
        node.attrs.latex || node.textContent,
        { throwOnError: false }
      ),
    ]
  },
})

/* ------------------------------------------------------------------ */
/*  ④  Image with caption / align                                     */
/* ------------------------------------------------------------------ */
export const CustomImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: '' },
      align: { default: 'center' },
      alt: { default: '' },
      missingAlt: { default: false },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      {
        class: `image align-${HTMLAttributes.align}${
          HTMLAttributes.missingAlt ? ' a11y-error' : ''
        }`,
      },
      ['img', { src: HTMLAttributes.src, alt: HTMLAttributes.alt }],
      ['figcaption', HTMLAttributes.caption],
    ]
  },
})
