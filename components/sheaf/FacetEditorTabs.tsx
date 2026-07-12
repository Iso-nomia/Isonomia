'use client';
import * as React from 'react';
import type { FacetDraft } from './FacetChipBar';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';

function asTipTapContent(body: any) {
  // If you already store TipTap JSON, pass it through.
  if (body && typeof body === 'object' && ('type' in body || 'content' in body)) return body;
  // Fallback: plain text -> paragraph doc
  const text = typeof body?.text === 'string' ? body.text : (typeof body === 'string' ? body : '');
  return { type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] };
}

export function FacetEditorTabs({
  facets, activeIndex, onFacetChange,
}: {
  facets: FacetDraft[];
  activeIndex: number;
  onFacetChange: (idx: number, patch: Partial<FacetDraft>) => void;
}) {
  const f = facets[activeIndex];
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: true, autolink: true }),
    ],
    content: asTipTapContent(f?.body),
    onUpdate({ editor }) {
      onFacetChange(activeIndex, { body: editor.getJSON() });
    },
    editorProps: {
      attributes: {
        class: 'min-h-[120px] border rounded p-2 bg-white/90 prose prose-sm focus:outline-none',
      },
    },
  }, [activeIndex]);

  // Update editor when you switch tabs/facets
  React.useEffect(() => {
    if (editor && f) editor.commands.setContent(asTipTapContent(f.body), false, { preserveWhitespace: 'full' });
  }, [activeIndex, f?.id]); // eslint-disable-line

  if (!f) return null;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex gap-2 items-center">
        <label className="text-xs">Policy:</label>
        <select
          className="text-xs border rounded px-2 py-1 bg-white/70"
          value={f.policy}
          onChange={(e) => onFacetChange(activeIndex, { policy: e.target.value as any })}
        >
          <option value="ALLOW">Allow</option>
          <option value="REDACT">Require Redact</option>
          <option value="FORBID">Forbid</option>
        </select>

        <label className="ml-3 text-xs">Expire:</label>
        <select
          className="text-xs border rounded px-2 py-1 bg-white/70"
          value={f.expiresAt ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            onFacetChange(activeIndex, { expiresAt: v === 0 ? null : Date.now() + v });
          }}
        >
          <option value={0}>Off</option>
          <option value={3600_000}>1h</option>
          <option value={86_400_000}>1d</option>
        </select>
      </div>

      {/* Toolbar (minimal) */}
      <div className="flex items-center gap-1 text-xs">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className="px-2 py-1 rounded bg-white/70">B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className="px-2 py-1 rounded bg-white/70"><i>I</i></button>
        <button onClick={() => editor?.chain().focus().toggleUnderline().run()} className="px-2 py-1 rounded bg-white/70"><u>U</u></button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="px-2 py-1 rounded bg-white/70">• List</button>
        <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="px-2 py-1 rounded bg-white/70">1. List</button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
