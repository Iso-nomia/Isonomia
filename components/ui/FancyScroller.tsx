
import React from "react";
export const FancyScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function FancyScroller({ className = '', children, ...props }, ref) {
      return (
        <div
          ref={ref}
          className={'relative overflow-y-auto ' + className}
          {...props}
          style={{
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 18px, black calc(100% - 18px), transparent)',
            maskImage:
              'linear-gradient(to bottom, transparent, black 18px, black calc(100% - 18px), transparent)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-white/75 to-transparent dark:from-slate-900/60"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white/80 to-transparent dark:from-slate-900/60"
          />
          {children}
        </div>
      );
    }
  );
  