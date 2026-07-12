// lib/tiptap/extensions/text-style-tokens.ts
import { Mark, mergeAttributes } from "@tiptap/core";

import TextStyle from '@tiptap/extension-text-style'

/** Discrete token values to keep JSON predictable */
export type TextTokens = {
  ff?: "system" | "founders" | "bugrino" | "newedge" | "kolonia";
  fs?: "12" | "14" | "16" | "18" | "20" | "24" | "32" | "48";
  clr?: "accent" | "muted" | "red";
  fw?: "300" | "400" | "500" | "600" | "700" | "800";
  lh?: "tight" | "normal" | "loose";
  ls?: "tight" | "normal" | "wide";
  tt?: "none" | "upper" | "lower" | "caps" | "smallcaps";
  bg?: "none" | "yellow" | "blue" | "green" | "red";
};


declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textStyleTokens: {
      /** Merge in any subset of tokens */
      setTextStyleTokens: (tokens: Partial<TextTokens>) => ReturnType;
      /** Remove specific tokens */
      unsetTextStyleTokens: (keys: (keyof TextTokens)[]) => ReturnType;
      /** Clear all tokens on selection */
      clearTextStyleTokens: () => ReturnType;
    };
  }
}


const FONT_MAP: Record<string, string> = {
  "'Founders', sans-serif": 'founders',
  "'Bugrino', serif": 'bugrino',
  "'New Edge Test', serif": 'newedge',
  "'Kolonia', serif": 'kolonia',
  inherit: 'system',
}
const SIZE_MAP: Record<string, string> = {
  '12px': '12','14px': '14','16px': '16','18px': '18',
  '20px': '20','24px': '24','32px': '32','48px': '48',
}
const COLOR_MAP: Record<string, string> = {
  '#333333': 'accent',
  '#d52020': 'red',
}

export const TextStyleTokensLegacy = TextStyle.extend({
  name: 'textStyle',
  

  addAttributes() {
    return {
      // New token attributes
      ff:  { default: null }, // 'system' | 'founders' | 'bugrino' | 'newedge' | 'kolonia'
      fs:  { default: null }, // '12' | '14' | ... | '48'
      clr: { default: null }, // 'accent' | 'red' | 'muted' | ...
      // Legacy attrs (kept only to migrate existing content gracefully)
      fontFamily: { default: null },
      fontSize:   { default: null },
      color:      { default: null },
    }
  },
  renderHTML({ HTMLAttributes }) {
    const { ff, fs, clr, ...rest } = HTMLAttributes
    const out:any = { ...rest }
    if (ff)  out['data-ff']  = ff
    if (fs)  out['data-fs']  = fs
    if (clr) out['data-clr'] = clr
    return ['span', out, 0]
  },

})


export const TextStyleTokens = Mark.create({
  name: "textStyleTokens",
  inclusive: true,

  addAttributes() {
    return {
      ff: { default: null },
      fs: { default: null },
      clr: { default: null },
      fw: { default: null },
      lh: { default: null },
      ls: { default: null },
      tt: { default: null },
      bg: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-ff],span[data-fs],span[data-clr],span[data-fw],span[data-lh],span[data-ls],span[data-tt],span[data-bg]",
        getAttrs: el => {
          const e = el as HTMLElement;
          return {
            ff: e.getAttribute("data-ff"),
            fs: e.getAttribute("data-fs"),
            clr: e.getAttribute("data-clr"),
            fw: e.getAttribute("data-fw"),
            lh: e.getAttribute("data-lh"),
            ls: e.getAttribute("data-ls"),
            tt: e.getAttribute("data-tt"),
            bg: e.getAttribute("data-bg"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Only emit attributes that are set
    const attrs: Record<string, string> = {};
    for (const k of ["ff","fs","clr","fw","lh","ls","tt","bg"] as const) {
      const v = (HTMLAttributes as any)[k];
      if (v) attrs[`data-${k}`] = String(v);
    }
    // nothing set? don’t wrap
    if (Object.keys(attrs).length === 0) return ["span", 0];
    return ["span", mergeAttributes(attrs), 0];
  },

  addCommands() {
    return {
      setTextStyleTokens:
        (tokens) =>
        ({ chain, tr }) => {
          // merge by setting mark with attributes
          return chain().setMark(this.name, tokens as any).run();
        },
      unsetTextStyleTokens:
        (keys) =>
        ({ chain, state }) => {
          // remove specific attrs by resetting mark with those keys null
          const nulls = Object.fromEntries(keys.map(k => [k, null]));
          return chain().updateAttributes(this.name, nulls).run();
        },
      clearTextStyleTokens:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name).run();
        },
    };
  },
});
