
// app/(kb)/kb/pages/[id]/edit/ui/TextBlockLexical.tsx
'use client';
import * as React from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
 import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { $getRoot, $createParagraphNode, $createTextNode, EditorState } from 'lexical';

type Props = {
  blockId: string;
  initialState?: any;               // lexical JSON
  onInsertBlock: (kind: 'claim'|'argument'|'sheet'|'room_summary'|'transport'|'image'|'link') => void;
  onSave: (nextJson: any, maybeMd: string) => void;
};

export default function TextBlockLexical({ blockId, initialState, onInsertBlock, onSave }: Props) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null); // <-- 1. Ref for the menu

  const initialConfig = React.useMemo(() => ({
    namespace: `kb-text-${blockId}`,
    editorState: (editor: any) => {
      if (initialState) {
        const parsed = editor.parseEditorState(initialState);
        editor.setEditorState(parsed);
        return;
      }
      const root = $getRoot();
      if (root.getFirstChild() == null) {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(''));
        root.append(paragraph);
      }
    },
    onError: (e: any) => console.error('Lexical error', e),
    theme: {
      paragraph: 'mb-2',
      text: { bold:'font-semibold', italic:'italic', underline:'underline' }
    }
  }), [blockId, initialState]);

  // crude “/” menu: open when slash typed on empty selection
  const onKeyDown = (e: React.KeyboardEvent) => {
    // Toggle menu with Cmd/Ctrl + /
    if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setOpen(v => !v);
    }
    // <-- 3. Close menu with Escape key
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const debouncedSave = React.useRef<any>(null);
  const handleChange = (state: EditorState) => {
    if (debouncedSave.current) clearTimeout(debouncedSave.current);
    debouncedSave.current = setTimeout(() => {
      let md = '';
      state.read(() => {
        const root = $getRoot();
        const txt = root.getTextContent();
        md = txt ?? '';
      });
      onSave(state.toJSON(), md);
    }, 400);
  };

  // <-- 2. Effect to handle clicks outside the menu
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    // Cleanup function to remove the listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]); // Rerun this effect only when `open` changes

  return (
    <div className="relative">
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-[80px] px-3 py-2  articlesearchfield rounded-lg "
              onKeyDown={onKeyDown}
              aria-label="KB text block editor"
            />
          }
          placeholder={<div className="pt-2 px-1 pb-1 text-[9px] text-slate-400">Type “/” (with Ctrl/Cmd) for inserts…</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
      </LexicalComposer>

      {open && (
        // Added ref to the menu container
        <div ref={menuRef} className="absolute z-20 mt-1 w-56 rounded-md border bg-white shadow-lg">
          {([
            ['claim','Insert Claim'],
            ['argument','Insert Argument'],
            ['sheet','Insert Sheet'],
            ['room_summary','Insert Room summary'],
            ['transport','Insert Transport'],
            ['image','Insert Image'],
            ['link','Insert Link'],
          ] as const).map(([kind,label]) => (
            <button
              key={kind}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => { setOpen(false); onInsertBlock(kind); }}
            >{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}