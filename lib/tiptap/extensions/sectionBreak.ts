import { Node, mergeAttributes } from '@tiptap/core';

export const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'hr[data-section-break]' }, { tag: 'hr.section-break' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'hr',
      mergeAttributes(HTMLAttributes, {
        'data-section-break': '1',
        class: 'section-break',   // <-- add the class so either selector works
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-Enter': () => this.editor.commands.insertContent({ type: this.name }),
    };
  },
});
