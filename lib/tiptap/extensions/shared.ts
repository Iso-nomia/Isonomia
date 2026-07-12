import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
// Your SSR-friendly TextAlign extension (you already referenced this)
import { SSRTextAlign } from '@/lib/tiptap/extensions/ssr-text-align';
import { FancyTextStyle } from './FancyTextStyle';
import { SectionBreak } from './sectionBreak';


// If you later add font family/size/letter/line/transform, we’ll extend TextStyle (see next section)
export function tiptapSharedExtensions() {
  return [
    StarterKit.configure({
      // keep these in sync with the editor’s StarterKit config
      bulletList: { keepMarks: true, keepAttributes: true },
      orderedList: { keepMarks: true, keepAttributes: true },
    }),
    FancyTextStyle,                          // <-- replaces TextStyle
    Color.configure({ types: ['textStyle'] }),    // <-- color spans
    Underline,
    Highlight,
    Link.configure({ openOnClick: true, autolink: true }),
    SSRTextAlign.configure({ types: ['heading', 'paragraph'] }),
    SectionBreak,                                  // 👈 include here

  ];
}
