import Paragraph from '@tiptap/extension-paragraph';

export const ParagraphKeepEmptySSR = Paragraph.extend({
  renderHTML({ node, HTMLAttributes }) {
    if (node.childCount === 0) {
      // Render an explicit line break so empty paragraphs show on the reader
      return ['p', HTMLAttributes, ['br']];
    }
    return ['p', HTMLAttributes, 0];
  },
});
