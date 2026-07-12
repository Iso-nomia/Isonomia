import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (font: string | null) => ReturnType
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
          renderHTML: attrs => attrs.fontFamily
            ? { style: `font-family:${attrs.fontFamily}` }
            : {},
          parseHTML: el => el.style.fontFamily || null,
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontFamily: font => ({ chain }) =>
        chain().setMark('textStyle', { fontFamily: font }).run(),
      unsetFontFamily: () => ({ chain }) =>
        chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run(),
    }
  },
})
