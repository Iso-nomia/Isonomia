"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { tiptapSharedExtensions } from "../../lib/tiptap/shared";
import EditorToolbar from "./EditorToolbar";
import FakeCaret from "./FakeCaret";

const BASE_CLASS =
  "prose prose-stone max-w-none p-8 border-[0px] border-[#a98c88] text-[#18161B] rounded-[5px] bg-[#fdfbf7] shadow-[inset_0_0_6px_rgba(139,69,19,0.4),_0_0_4px_rgba(27,22,24,0.5)]  tracking-wide focus:outline-none min-h-[60vh]";

// Poems keep their line breaks and stanza spacing, in serif, matching the
// read view. `whitespace-pre-wrap` preserves trailing spaces and soft breaks;
// tightening paragraph margins makes stanzas read as stanzas.
const POEM_CLASS =
  "prose prose-stone  max-w-none p-8  border-[0px] border-transparent text-[#18161B] rounded-[5px] bg-[#fdfbf7] shadow-[inset_0_0_6px_rgba(139,69,19,0.4),_0_0_4px_rgba(27,22,24,0.5)]    focus:outline-none min-h-[60vh]  [&_p]:whitespace-pre-wrap [&_p]:my-1";

/**
 * Shared rich-text editor used by both the create (`/write`) and edit
 * (`/entry/[id]/edit`) flows so they stay visually and behaviourally in sync.
 * The parent owns save logic; this component owns the Tiptap instance, the
 * toolbar, and genre-aware styling.
 *
 * The editor instance is handed back via `onReady` so the parent can call
 * `getJSON()` on save. Emptiness is reported through `onChange`.
 */
export default function RichTextEditor({
  genre,
  initialContent,
  autofocus = true,
  showToolbar = true,
  fakeCaret = true,
  onReady,
  onChange,
}: {
  genre: string;
  initialContent?: object | null;
  autofocus?: boolean | "start" | "end";
  showToolbar?: boolean;
  fakeCaret?: boolean;
  onReady?: (editor: Editor) => void;
  onChange?: (json: object, isEmpty: boolean) => void;
}) {
  const editorClass = genre === "POEM" ? POEM_CLASS : BASE_CLASS;
  const caretHostRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [...tiptapSharedExtensions()],
    editorProps: { attributes: { class: editorClass } },
    autofocus,
    immediatelyRender: false,
    content: initialContent ?? undefined,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON(), editor.isEmpty),
  });

  // Re-apply the editor container class when the genre changes (the editor is
  // created once; switching to/from POEM should restyle it live).
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({ editorProps: { attributes: { class: editorClass } } });
  }, [editor, editorClass]);

  // Hand the instance to the parent once ready.
  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  if (!editor) return null;

  return (
    <div className="space-y-4">
      {showToolbar && <EditorToolbar editor={editor} />}
      <div
        ref={caretHostRef}
        className={`relative ${fakeCaret ? "cp-has-fake-caret" : ""}`}
      >
        <EditorContent editor={editor} />
        {fakeCaret && <FakeCaret editor={editor} containerRef={caretHostRef} />}
      </div>
    </div>
  );
}
