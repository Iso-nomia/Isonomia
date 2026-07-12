import { Extension, type CommandProps } from '@tiptap/core';
import { NodeSelection, TextSelection, type EditorState } from 'prosemirror-state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    moveBlock: {
      /** Move the current block up within its parent. */
      moveBlockUp: () => ReturnType;
      /** Move the current block down within its parent. */
      moveBlockDown: () => ReturnType;
    };
  }
}

export const MoveBlock = Extension.create({
  name: 'moveBlock',

  addCommands() {
    const blockRange = (state: EditorState) => {
      const { $from } = state.selection as TextSelection;
      const depth = $from.depth;
      const pos = $from.before(depth);
      const node = state.doc.nodeAt(pos);
      return { pos, node, depth };
    };
    return {
      moveBlockUp:
        () =>
        ({ state, dispatch }: CommandProps) => {
          const { pos, node, depth } = blockRange(state);
          if (!node) return false;
          const $pos = state.doc.resolve(pos);
          const index = $pos.index($pos.depth);
          if (index === 0) return false; // already top
          const prevPos = $pos.before($pos.depth) - node.nodeSize - 1;
          const tr = state.tr.delete(pos, pos + node.nodeSize).insert(prevPos, node);
          dispatch?.(tr.setSelection(NodeSelection.create(tr.doc, prevPos)));
          return true;
        },
      moveBlockDown:
        () =>
        ({ state, dispatch }: CommandProps) => {
          const { pos, node } = blockRange(state);
          if (!node) return false;
          const after = pos + node.nodeSize;
          const $after = state.doc.resolve(after);
          const parent = $after.node($after.depth);
          const index = $after.index($after.depth);
          if (index >= parent.childCount) return false; // already last
          const insertPos = $after.after($after.depth);
          const tr = state.tr.delete(pos, pos + node.nodeSize).insert(insertPos, node);
          dispatch?.(tr.setSelection(NodeSelection.create(tr.doc, insertPos)));
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': () => this.editor.commands.moveBlockUp(),
      'Alt-ArrowDown': () => this.editor.commands.moveBlockDown(),
    };
  },
});
