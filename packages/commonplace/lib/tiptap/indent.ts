// @ts-nocheck — vendored from Mesh (lib/tiptap/extensions/); upstream has implicit-any quirks tolerated by Next build but flagged by strict tsc.
import { Extension } from '@tiptap/core';
import { sinkListItem, liftListItem } from '@tiptap/pm/schema-list';
import { TextSelection } from '@tiptap/pm/state';

const INDENTS = [null, 'sm', 'md', 'lg'] as const;
type IndentLevel = (typeof INDENTS)[number];

export const Indent = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    // store indent on blocks we care about
    return [
      {
        types: ['paragraph', 'heading', 'blockquote'],
        attributes: {
          indent: {
            default: null,
            parseHTML: el => el.getAttribute('data-indent') || null,
            renderHTML: attrs => attrs.indent ? { 'data-indent': attrs.indent } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const getBlockPos = (state: any) => {
      const { $from } = state.selection as TextSelection;
      const pos = $from.before($from.depth);
      const node = state.doc.nodeAt(pos);
      return { pos, node, $from };
    };

    const setIndent = (level: IndentLevel) => ({ state, dispatch }: any) => {
      const { pos, node } = getBlockPos(state);
      if (!node || !dispatch) return false;
      const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: level });
      dispatch(tr.scrollIntoView());
      return true;
    };

    const nextIndent = (cur: IndentLevel): IndentLevel => {
      const i = INDENTS.indexOf(cur as any);
      return INDENTS[Math.min(INDENTS.length - 1, Math.max(0, i + 1))] ?? 'lg';
    };
    const prevIndent = (cur: IndentLevel): IndentLevel => {
      const i = INDENTS.indexOf(cur as any);
      return INDENTS[Math.max(0, i - 1)] ?? null;
    };

    const isList = (state: any) => {
      const { $from } = state.selection as TextSelection;
      const parent = $from.node($from.depth);
      return parent?.type?.name === 'listItem';
    };

    return {
      indent:
        () =>
        ({ state, dispatch, view }) => {
          // Lists: nest
          if (isList(state)) {
            const type = state.schema.nodes.listItem;
            return sinkListItem(type)(state, dispatch);
          }
          // Paragraph/heading/blockquote: bump token
          const { pos, node } = getBlockPos(state);
          if (!node) return false;
          const cur = (node.attrs?.indent ?? null) as IndentLevel;
          return setIndent(nextIndent(cur))({ state, dispatch, view });
        },

      outdent:
        () =>
        ({ state, dispatch, view }) => {
          if (isList(state)) {
            const type = state.schema.nodes.listItem;
            return liftListItem(type)(state, dispatch);
          }
          const { pos, node } = getBlockPos(state);
          if (!node) return false;
          const cur = (node.attrs?.indent ?? null) as IndentLevel;
          return setIndent(prevIndent(cur))({ state, dispatch, view });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    };
  },
});
