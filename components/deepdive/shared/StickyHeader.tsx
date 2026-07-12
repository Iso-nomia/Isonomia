"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * StickyHeader Component
 * 
 * Extracted from DeepDivePanelV2.tsx (Week 1 - Phase 0)
 * A header that sticks to the top of the viewport with dynamic styling based on scroll
 * 
 * Features:
 * - Scroll detection
 * - Backdrop blur effect
 * - Transition animations
 */

export interface StickyHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function StickyHeader({ children, className = "" }: StickyHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={clsx(
        "sticky top-0 z-20 px-4 py-2 rounded-lg transition-all duration-200 w-full",
        "bg-sky-50/50 backdrop-blur-lg panelv2 hover:translate-y-0",
        className
      )}
    >
      {children}
    </div>
  );
}
