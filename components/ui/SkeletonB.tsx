export function SkeletonBlock({ className='' }: { className?: string }) {
    return <div className={`animate-pulse bg-neutral-200 rounded ${className}`} />;
  }
  
  export function SkeletonLines({ lines=3 }: { lines?: number }) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-full" />
        ))}
      </div>
    );
  }
  