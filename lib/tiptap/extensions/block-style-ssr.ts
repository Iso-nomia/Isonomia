// lib/tiptap/extensions/block-style-ssr.ts
import { Extension } from "@tiptap/core";

export const BlockStyleTokens = Extension.create({
  name: "blockStyleTokens",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "listItem"],
        attributes: {
          mt: { default: null },    // 0|xs|sm|md|lg
          mb: { default: null },
          indent: { default: null },// none|sm|md|lg
        },
      },
      {
        types: ["bulletList", "orderedList"],
        attributes: {
          list: { default: null },  // disc|circle|square|decimal|lower-roman|upper-roman|lower-alpha|upper-alpha
          start: { default: null }, // number for <ol>
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes, node }: { HTMLAttributes: Record<string, any>; node: any }) {
    // We don't override default render; attributes get merged by TipTap.
    return [];
  },
});
