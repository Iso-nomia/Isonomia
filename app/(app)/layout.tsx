'use client';

import '@/app/article.templates.css';   // <— single import
// import './article.global.scss';
import "@/app/article/editor.global.css";
import "@/app/article/rhetoric.css";

import "@/app/article/type-tokens.css";
import '@/app/fonts/fonts.css';
import { useEffect } from 'react';
import { LiveEventsProvider } from '@/app/agora/LiveEventsProvider';


const TOPICS = [
  "dialogue:moves:refresh","dialogue:cs:refresh","claims:edges:changed","cqs:changed","cards:changed",
  "decision:changed","votes:changed","stacks:changed","deliberations:created","comments:changed",
  "xref:changed","citations:changed","dialogue:changed"
];

function LiveEvents() {
  useEffect(() => {
    const es = new EventSource('/api/events');

    // default (unlabeled)
    es.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        // normalize {type,payload}
        const flat = m?.payload && typeof m.payload === 'object' ? { type: m.type, ...m.payload } : m;
        if (flat?.type) {
          window.dispatchEvent(new CustomEvent(flat.type, { detail: flat }));
        }
      } catch {}
    };

    // named events
    for (const name of TOPICS) {
      es.addEventListener(name, (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          const flat = data?.payload && typeof data.payload === 'object' ? { type: name, ...data.payload } : { type: name, ...data };
          window.dispatchEvent(new CustomEvent(name, { detail: flat }));
        } catch {}
      });
    }

    return () => es.close();
  }, []);
  return null;
}

// export default function AppLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="en">
//       <body>
//         <LiveEvents />
//         {children}
//       </body>
//     </html>
//   );
// }
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveEventsProvider>
          {children}
        </LiveEventsProvider>
      </body>
    </html>
  );
}