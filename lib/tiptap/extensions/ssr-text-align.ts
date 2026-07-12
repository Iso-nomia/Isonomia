// lib/tiptap/extensions/ssr-text-align.ts
import TextAlign from "@tiptap/extension-text-align";

export const SSRTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph", "blockquote", "listItem"],
        attributes: {
          textAlign: {
            default: null,
            renderHTML: (attributes) => {
              const align = attributes.textAlign;
              if (!align) return {};
              return { "data-align": align, class: `ta-${align}` };
            },
            parseHTML: (element) => {
              const data = element.getAttribute("data-align");
              if (data) return data;
              const cls = element.getAttribute("class") || "";
              const m = cls.match(/\bta-(left|right|center|justify)\b/);
              if (m) return m[1];
              // @ts-ignore (runtime safe)
              return element.style?.textAlign || null;
            },
          },
        },
      },
    ];
  },
});
