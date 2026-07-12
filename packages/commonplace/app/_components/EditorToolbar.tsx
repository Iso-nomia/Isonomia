"use client";

import { useEffect, useReducer } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Formatting toolbar for the shared RichTextEditor. Buttons run Tiptap
 * commands and reflect the active mark/node at the current selection.
 *
 * Tiptap's `editor.isActive(...)` is only accurate at render time, so we
 * subscribe to editor transactions and force a re-render on each — this keeps
 * the active states in sync regardless of how the parent re-renders.
 */
export default function EditorToolbar({ editor }: { editor: Editor | null }) {
  const [, force] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", force);
    editor.on("selectionUpdate", force);
    return () => {
      editor.off("transaction", force);
      editor.off("selectionUpdate", force);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[5px] bg-[#fdfbf7] shadow-[inset_0_0_6px_rgba(139,69,19,0.4),_0_0_4px_rgba(27,22,24,0.5)]  border-[0px] border-[#a98c88] p-1 font-sans">
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Bold"
      >
        <span className="font-bold">B</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Italic"
      >
        <span className="italic">I</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        label="Underline"
      >
        <span className="underline">U</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        label="Strikethrough"
      >
        <span className="line-through">S</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive("highlight")}
        label="Highlight"
      >
        <span className="rounded-[2px] bg-orange-200/80 px-1 text-[#5c4033]">H</span>
      </Btn>

      <Divider />

      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        label="Heading 1"
      >
        H1
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="Heading 2"
      >
        H2
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="Heading 3"
      >
        H3
      </Btn>
       <Btn
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive("paragraph")}
        label="Paragraph"
      >
        ¶
      </Btn>

      <Divider />

      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Bullet list"
      >
        •
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Numbered list"
      >
        1.
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="Blockquote"
      >
        ❝
      </Btn>

      <Divider />

      <Btn onClick={() => setLink(editor)} active={editor.isActive("link")} label="Link">
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M10 13a5 5 0 0 0 7.07 0l1.93-1.93a5 5 0 0 0-7.07-7.07L11 5" />
          <path d="M14 11a5 5 0 0 0-7.07 0L5 12.93a5 5 0 0 0 7.07 7.07L13 19" />
        </svg>
      </Btn>
      <Btn
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
        active={false}
        label="Clear formatting"
      >
        <span className="text-base leading-none">×</span>
      </Btn>
    </div>
  );
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", previous ?? "https://");
  if (url === null) return; // cancelled
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
}

function Btn({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex min-w-[28px] items-center justify-center border border-transparent rounded px-2 py-1 text-sm leading-none transition ${
        active
          ? "bg-[rgba(190,150,140,.5)] text-[rgb(164,36,27)]"
          : "text-[#6b5744] hover:text-[rgb(164,36,27)] hover:border hover:border-[rgb(164,36,27)]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-[#d8c4a8]" aria-hidden />;
}
