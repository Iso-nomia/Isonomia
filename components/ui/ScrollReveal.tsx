'use client';
import * as React from 'react';

export default function ScrollReveal({
  title,
  panelHeight = 600,                 
  defaultExpanded = false,
  children,
  className = '',
  onToggle,
}: {
  title?: string;
  panelHeight?: number;    // fixed height in both states
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
  onToggle?: (expanded: boolean) => void;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const style: React.CSSProperties = {
    height: `${panelHeight}px`,
    overflowY: expanded ? 'hidden' : 'hidden',
  };

  const toggle = (next: boolean) => {
    setExpanded(next);
    onToggle?.(next);
  };

  return (
    <section className={`relative ${className} overflow-y-hidden`} style={style}>
      {title && <div className="mb-2 text-sm font-medium ">{title}</div>}

      <div className="relative rounded border bg-white" style={style}>
        {children}

        {!expanded && (
          <>
            {/* bottom fade overlay */}
            <div className="pointer-events-none overflow-y-hidden absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
            <div className="absolute inset-x-0 bottom-2 flex justify-center">
              <button
                type="button"
                className="px-4 py-1 text-sm rounded-md  border bg-white shadow-sm"
                onClick={() => toggle(true)}
              >
                Expand
              </button>
            </div>
          </>
        )}
      </div>

      {expanded && (
        <div className="mt-2 flex justify-center overflow-y-hidden">
          <button
            type="button"
            className="px-4 py-1 text-sm rounded-md border bg-white shadow-sm"
            onClick={() => toggle(false)}
          >
            Collapse
          </button>
        </div>
      )}
    </section>
  );
}
