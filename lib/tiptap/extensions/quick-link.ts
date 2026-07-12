import { Extension } from '@tiptap/core';

export const QuickLink = Extension.create({
  name: 'quickLink',

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const url = prompt('Paste or type a URL');
        if (!url) return true;
        try {
          const href = new URL(url).toString();
          this.editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .setLink({ href, target: '_blank', rel: 'noopener noreferrer' })
            .run();
        } catch {
          // ignore invalid URL
        }
        return true;
      },
      'Mod-Shift-k': () => {
        this.editor.chain().focus().unsetLink().run();
        return true;
      },
    };
  },
});
