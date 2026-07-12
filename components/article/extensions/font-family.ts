import { Mark, mergeAttributes } from "@tiptap/core";
import { Extension } from '@tiptap/core'


declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (family: string | null) => ReturnType
      unsetFontFamily: () => ReturnType
    }
  }
}


export const FontFamily = Extension.create({
  name: 'fontFamily',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: el => el.style.fontFamily || null,
          renderHTML: attrs => attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontFamily:
        (family) => ({ chain }) =>
          chain().setMark('textStyle', { fontFamily: family ?? null }).run(),
      unsetFontFamily:
        () => ({ chain }) =>
          chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
    }
  },
})