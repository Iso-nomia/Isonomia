// components/layout/ReaderColumn.tsx
import clsx from "clsx";

export function ReaderColumn({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("mx-auto w-full max-w-6xl px-4", className)}>{children}</div>;
}
