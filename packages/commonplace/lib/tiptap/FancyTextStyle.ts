import TextStyle from '@tiptap/extension-text-style';

export const FancyTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      color: {                     // Color already handled by Color extension, but harmless to keep
        default: null,
        parseHTML: el => el.style.color || null,
        renderHTML: attrs => attrs.color ? { style: `color: ${attrs.color}` } : {},
      },
      fontFamily: {
        default: null,
        parseHTML: el => el.style.fontFamily || null,
        renderHTML: a => a.fontFamily ? { style: `font-family: ${a.fontFamily}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: el => el.style.fontSize || null,
        renderHTML: a => a.fontSize ? { style: `font-size: ${a.fontSize}` } : {},
      },
      fontWeight: {
        default: null,
        parseHTML: el => el.style.fontWeight || null,
        renderHTML: a => a.fontWeight ? { style: `font-weight: ${a.fontWeight}` } : {},
      },
      letterSpacing: {
        default: null,
        parseHTML: el => el.style.letterSpacing || null,
        renderHTML: a => a.letterSpacing ? { style: `letter-spacing: ${a.letterSpacing}` } : {},
      },
      lineHeight: {
        default: null,
        parseHTML: el => el.style.lineHeight || null,
        renderHTML: a => a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {},
      },
      textTransform: {
        default: null,
        parseHTML: el => el.style.textTransform || null,
        renderHTML: a => a.textTransform ? { style: `text-transform: ${a.textTransform}` } : {},
      },
      fontVariantCaps: { // small-caps
        default: null,
        parseHTML: el => el.style.fontVariantCaps || null,
        renderHTML: a => a.fontVariantCaps ? { style: `font-variant-caps: ${a.fontVariantCaps}` } : {},
      },
    };
  },
});
