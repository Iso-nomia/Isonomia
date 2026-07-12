// components/deepdive/DeepDiveBackdrop.tsx
export function DeepDiveBackdrop({
    attach = 'absolute', // 'absolute' | 'fixed'
    className = '',
  }: {
    attach?: 'absolute' | 'fixed';
    className?: string;
  }) {
       const attachClass =
         attach === 'fixed'
           ? 'fixed inset-0 z-0'
          : 'absolute inset-0 -z-10';
    return (
      <div aria-hidden className={`pointer-events-none ${attachClass} w-full h-full ${className}`}>
        {/* pastel wash + grid (dark-mode aware) */}
        <div className="absolute inset-0 bg-gradient-to-b
                        from-indigo-50 via-rose-50 to-slate-50
                        dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" />
      
        {/* drifting glows (very slow; reduced-motion safe via CSS media query) */}
        <style>{`
         @media (prefers-reduced-motion: no-preference) {
           @keyframes driftA { 0%{transform:translate(0,0)} 50%{transform:translate(16px,10px)} 100%{transform:translate(0,0)} }
           @keyframes driftB { 0%{transform:translate(0,0)} 50%{transform:translate(-14px,-8px)} 100%{transform:translate(0,0)} }
           .ddb-animA { animation: driftA 14s ease-in-out infinite; }
           .ddb-animB { animation: driftB 16s ease-in-out infinite; }
         }
       `}</style>
        <div
          className="absolute left-1/3 -top-24 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl ddb-animA"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,0.45) 0%, transparent 60%)',
              willChange: 'transform',
          }}
        />
        <div
          className="absolute right-1/4 bottom-0 h-[24rem] w-[24rem] translate-x-1/2 rounded-full opacity-25 blur-3xl ddb-animB"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 50%, rgba(244,114,182,0.45) 0%, transparent 60%)',
              willChange: 'transform',
          }}
        />
      </div>
    );
  }
  