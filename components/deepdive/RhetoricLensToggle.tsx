'use client';
import { useState } from 'react';

const HEDGES = ['might','could','appears','seems','likely','suggests','perhaps','possibly','arguably'];
const INTENSIFIERS = ['very','extremely','incredibly','undeniably','obviously','clearly'];
const ANALOGY_TRIGGERS = ['like','as if','as though','akin to'];
const METAPHOR_TRIGGERS = ['is a','becomes','turns into'];

export function annotateText(text: string) {
  // naive highlight—don’t mutate stored HTML
  function wrapWords(words: string[], cls: string) {
    const re = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
    return text.replace(re, (m) => `<mark data-rhetoric="${cls}">${m}</mark>`);
  }
  let out = text;
  out = wrapWords(HEDGES, 'hedge');
  out = wrapWords(INTENSIFIERS, 'intensifier');
  out = wrapWords(ANALOGY_TRIGGERS, 'analogy');
  out = wrapWords(METAPHOR_TRIGGERS, 'metaphor');
  return out;
}

export default function RhetoricLensToggle(props: { html: string }) {
  const [styleOn, setStyleOn] = useState(false);
  const rendered = styleOn ? annotateText(props.html) : props.html;
  return (
    <div className="border rounded">
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b">
        <div className="text-sm">Rhetoric Lens</div>
        <label className="text-sm flex items-center gap-2">
          <span>Style</span>
          <input type="checkbox" checked={styleOn} onChange={e=>setStyleOn(e.target.checked)} />
        </label>
      </div>
      <div className="prose max-w-none p-3" dangerouslySetInnerHTML={{ __html: rendered }} />
    </div>
  );
}
