import { Extension } from '@tiptap/core';

export const CodeBlockTab = Extension.create({
  name: 'codeBlockTab',

  addKeyboardShortcuts() {
    const INDENT = '  '; // 2 spaces; or '\t'
    return {
      Tab: ({ editor }) => {
        const { state, view } = editor;
        const $from = state.selection.$from;
        const inCode = $from.parent.type.name === 'codeBlock';
        if (!inCode) return false;
        view.dispatch(state.tr.insertText(INDENT));
        return true;
      },
      'Shift-Tab': ({ editor }) => {
        const { state, view } = editor;
        const $from = state.selection.$from;
        const inCode = $from.parent.type.name === 'codeBlock';
        if (!inCode) return false;
        const { from, to } = state.selection;
        const before = state.doc.textBetween(from - 2, from) || '';
        if (before.endsWith('  ')) {
          view.dispatch(state.tr.delete(from - 2, from));
          return true;
        }
        return false;
      },
    };
  },
});
