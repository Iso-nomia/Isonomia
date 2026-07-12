// components/rhetoric/RhetoricLensBlock.tsx
'use client';
import RhetoricHtml from './RhetoricHtml';
import RhetoricControls from './RhetoricControls';

export default function RhetoricLensBlock({ html, sampleForCounts }: { html: string; sampleForCounts?: string }) {
  return (
    <div className="border rounded">
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b">
        <div className="text-sm font-semibold">Rhetoric Lens</div>
        <RhetoricControls sample={sampleForCounts ?? html.replace(/<[^>]+>/g,' ')} />
      </div>
      <div className="p-3">
        <RhetoricHtml html={html} />
      </div>
    </div>
  );
}
