import { Editor } from "@tiptap/react";
import React from "react";
import type { TextTokens } from "@/lib/tiptap/extensions/text-style-ssr";
import {
  Bold, Italic, Underline, Strikethrough, Code,
  List, ListOrdered, ListChecks, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link2, Image as ImageIcon, Eraser,
  Type, ArrowUpDown, ArrowLeftRight, CaseSensitive,
  Highlighter, Pilcrow, ArrowUp, ArrowDown,
  Palette, ZoomIn,
} from "lucide-react";

type Props = { editor: Editor | null };

/** Icon-sized native select
 * - Matches btn: 32x32, rounded, hover
 * - Click opens system dropdown; no global CSS, no popovers
 */
function IconSelect({
  title,
  icon,
  onChange,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <button className="relative inline-grid h-8 w-8 place-items-center rounded hover:bg-neutral-100">
      <span className="sr-only">{title}</span>
      <select
        title={title}
        className="absolute inset-0 h-8 w-8 opacity-0 cursor-pointer"
        onChange={onChange}
      >
        {children}
      </select>
      <span className="pointer-events-none">{icon}</span>
    </button>
  );
}

export default function Toolbar({ editor }: Props) {
  if (!editor) return null;

  const btn = (icon: React.ReactNode, onClick: () => void, active = false) => (
    <button
      onClick={onClick}
      type="button"
      className={`p-1.5 rounded ${active ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
    >
      {icon}
    </button>
  );

  // options
  const fontOptions = [
    { label: "System Sans", value: "system" },
    { label: "Founders", value: "founders" },
    { label: "Bugrino", value: "bugrino" },
    { label: "New Edge Test", value: "newedge" },
    { label: "Kolonia", value: "kolonia" },
  ];
  const sizeOptions = ["12", "14", "16", "18", "20", "24", "32", "48"];
  const colorOptions = [
    { label: "Accent", value: "accent" },
    { label: "Muted", value: "muted" },
    { label: "Red", value: "red" },
  ];
  const weightOptions = ["300", "400", "500", "600", "700", "800"];
  const lineHeightOptions = [
    { label: "Tight", value: "tight" },
    { label: "Normal", value: "normal" },
    { label: "Loose", value: "loose" },
  ];
  const letterSpaceOptions = [
    { label: "Tight", value: "tight" },
    { label: "Normal", value: "normal" },
    { label: "Wide", value: "wide" },
  ];
  const transformOptions = [
    { label: "None", value: "none" },
    { label: "UPPERCASE", value: "upper" },
    { label: "lowercase", value: "lower" },
    { label: "Capitalized", value: "caps" },
    { label: "Small Caps", value: "smallcaps" },
  ];
  const highlightOptions = [
    { label: "None", value: "none" },
    { label: "Yellow", value: "yellow" },
    { label: "Blue", value: "blue" },
    { label: "Green", value: "green" },
    { label: "Red", value: "red" },
  ];

  // helpers for block attrs
  const activeBlock = () =>
    editor!.isActive("heading")
      ? "heading"
      : editor!.isActive("listItem")
      ? "listItem"
      : "paragraph";

  const setBlockAttrs = (attrs: Record<string, any>) =>
    editor!.chain().focus().updateAttributes(activeBlock(), attrs).run();

  const setULStyle = (list: "disc" | "circle" | "square") =>
    editor!.chain().focus().updateAttributes("bulletList", { list }).run();

  const setOLStyle = (
    list:
      | "decimal"
      | "lower-roman"
      | "upper-roman"
      | "lower-alpha"
      | "upper-alpha",
  ) => editor!.chain().focus().updateAttributes("orderedList", { list }).run();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-t-xl px-3 py-3 bg-white/50">

      {/* Font (iconized) */}
      <IconSelect
        title="Font family"
        icon={<Type size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          editor!.chain().focus().setTextStyleTokens({ ff: v as TextTokens["ff"] }).run();
        }}
      >
        {/* keep first option as a hint label in the menu */}
        <option value="" disabled>Font</option>
        {fontOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </IconSelect>

      {/* Size (iconized) */}
      <IconSelect
        title="Font size"
        icon={<ZoomIn size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          v === "unset"
            ? editor!.chain().focus().unsetTextStyleTokens(["fs"]).run()
            : editor!.chain().focus().setTextStyleTokens({ fs: v as TextTokens["fs"] }).run();
        }}
      >
        <option value="" disabled>Size</option>
        <option value="unset">Default</option>
        {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
      </IconSelect>

      {/* Color (iconized) */}
      <IconSelect
        title="Text color"
        icon={<Palette size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          v === "unset"
            ? editor!.chain().focus().unsetTextStyleTokens(["clr"]).run()
            : editor!.chain().focus().setTextStyleTokens({ clr: v as TextTokens["clr"] }).run();
        }}
      >
        <option value="" disabled>Color</option>
        <option value="unset">Default</option>
        {colorOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </IconSelect>

      {/* Advanced token controls (already iconized) */}
      <IconSelect
        title="Weight"
        icon={<Type size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          v === "unset"
            ? editor!.chain().focus().unsetTextStyleTokens(["fw"]).run()
            : editor!.chain().focus().setTextStyleTokens({ fw: v as any }).run();
        }}
      >
        <option value="unset">Default</option>
        {weightOptions.map(w => <option key={w} value={w}>{w}</option>)}
      </IconSelect>

      <IconSelect
        title="Line height"
        icon={<ArrowUpDown size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          v === "unset"
            ? editor!.chain().focus().unsetTextStyleTokens(["lh"]).run()
            : editor!.chain().focus().setTextStyleTokens({ lh: v as any }).run();
        }}
      >
        <option value="unset">Default</option>
        {lineHeightOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </IconSelect>

      <IconSelect
        title="Letter spacing"
        icon={<ArrowLeftRight size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          v === "unset"
            ? editor!.chain().focus().unsetTextStyleTokens(["ls"]).run()
            : editor!.chain().focus().setTextStyleTokens({ ls: v as any }).run();
        }}
      >
        <option value="unset">Default</option>
        {letterSpaceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </IconSelect>

      <IconSelect
        title="Transform"
        icon={<CaseSensitive size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          v === "unset"
            ? editor!.chain().focus().unsetTextStyleTokens(["tt"]).run()
            : editor!.chain().focus().setTextStyleTokens({ tt: v as any }).run();
        }}
      >
        <option value="unset">Default</option>
        {transformOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </IconSelect>

      <IconSelect
        title="Highlight"
        icon={<Highlighter size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          v === "unset" || v === "none"
            ? editor!.chain().focus().unsetTextStyleTokens(["bg"]).run()
            : editor!.chain().focus().setTextStyleTokens({ bg: v as any }).run();
        }}
      >
        <option value="unset">None</option>
        {["yellow","blue","green","red"].map(v => <option key={v} value={v}>{v}</option>)}
      </IconSelect>

      {/* Inline marks */}
      {btn(<Bold size={16} />, () => editor!.chain().focus().toggleBold().run(), editor!.isActive("bold"))}
      {btn(<Italic size={16} />, () => editor!.chain().focus().toggleItalic().run(), editor!.isActive("italic"))}
      {btn(<Underline size={16} />, () => editor!.chain().focus().toggleUnderline().run(), editor!.isActive("underline"))}
      {btn(<Strikethrough size={16} />, () => editor!.chain().focus().toggleStrike().run(), editor!.isActive("strike"))}
      {btn(<Code size={16} />, () => editor!.chain().focus().toggleCode().run(), editor!.isActive("code"))}

      {/* Lists */}
      {btn(<List size={16} />, () => editor!.chain().focus().toggleBulletList().run(), editor!.isActive("bulletList"))}
      {btn(<ListOrdered size={16} />, () => editor!.chain().focus().toggleOrderedList().run(), editor!.isActive("orderedList"))}
      {btn(<ListChecks size={16} />, () => editor!.chain().focus().toggleTaskList().run(), editor!.isActive("taskList"))}

      {/* Align */}
      {btn(<AlignLeft size={16} />, () => editor!.chain().focus().setTextAlign("left").run(), editor!.isActive({ textAlign: "left" }))}
      {btn(<AlignCenter size={16} />, () => editor!.chain().focus().setTextAlign("center").run(), editor!.isActive({ textAlign: "center" }))}
      {btn(<AlignRight size={16} />, () => editor!.chain().focus().setTextAlign("right").run(), editor!.isActive({ textAlign: "right" }))}
      {btn(<AlignJustify size={16} />, () => editor!.chain().focus().setTextAlign("justify").run(), editor!.isActive({ textAlign: "justify" }))}

      {/* Paragraph block attrs */}
      <IconSelect
        title="Indent"
        icon={<Pilcrow size={16} />}
        onChange={(e) => {
          const v = e.target.value; // 'unset' | sm | md | lg
          setBlockAttrs({ indent: v === "unset" ? null : v });
        }}
      >
        <option value="unset">None</option>
        <option value="sm">Small</option>
        <option value="md">Medium</option>
        <option value="lg">Large</option>
      </IconSelect>

      <IconSelect
        title="Margin top"
        icon={<ArrowUp size={16} />}
        onChange={(e) => {
          const v = e.target.value; // '0' | xs | sm | md | lg
          setBlockAttrs({ mt: v === "0" ? "0" : v });
        }}
      >
        <option value="0">0</option>
        <option value="xs">xs</option>
        <option value="sm">sm</option>
        <option value="md">md</option>
        <option value="lg">lg</option>
      </IconSelect>

      <IconSelect
        title="Margin bottom"
        icon={<ArrowDown size={16} />}
        onChange={(e) => {
          const v = e.target.value;
          setBlockAttrs({ mb: v === "0" ? "0" : v });
        }}
      >
        <option value="0">0</option>
        <option value="xs">xs</option>
        <option value="sm">sm</option>
        <option value="md">md</option>
        <option value="lg">lg</option>
      </IconSelect>

      {/* List styles */}
      <IconSelect
        title="Bullet style"
        icon={<List size={16} />}
        onChange={(e) => setULStyle(e.target.value as any)}
      >
        <option value="disc">disc</option>
        <option value="circle">circle</option>
        <option value="square">square</option>
      </IconSelect>

      <IconSelect
        title="Number style"
        icon={<ListOrdered size={16} />}
        onChange={(e) => setOLStyle(e.target.value as any)}
      >
        <option value="decimal">decimal</option>
        <option value="lower-roman">lower-roman</option>
        <option value="upper-roman">upper-roman</option>
        <option value="lower-alpha">lower-alpha</option>
        <option value="upper-alpha">upper-alpha</option>
      </IconSelect>

      {/* Blockquote */}
      {btn(<Quote size={16} />, () => editor!.chain().focus().toggleBlockquote().run(), editor!.isActive("blockquote"))}

      {/* Link / Image */}
      {btn(
        <Link2 size={16} />,
        () => {
          const url = prompt("URL")?.trim();
          if (url) editor!.chain().focus().setLink({ href: url }).run();
        },
        editor!.isActive("link"),
      )}
      {btn(<ImageIcon size={16} />, () => {
        document.querySelector<HTMLInputElement>("#image-upload")?.click();
      })}

      {/* Clear */}
      {btn(<Eraser size={16} />, () =>
        editor!.chain().focus().clearNodes().unsetAllMarks().run()
      )}
      <button
        onClick={() =>
          editor!.chain().focus()
            .unsetTextStyleTokens(["ff","fs","clr","fw","lh","ls","tt","bg"])
            .run()
        }
        className="text-[.9rem]"
        type="button"
      >
        Clear
      </button>
    </div>
  );
}
