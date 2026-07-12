// components/ui/FloatingSheet.tsx
'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface FloatingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'left' | 'right';
  width?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  showBackdrop?: boolean;
  icon?: React.ReactNode;
  variant?: 'light' | 'dark' | 'glass-dark'; // New variant prop
}

export function FloatingSheet({
  open,
  onOpenChange,
  side,
  width = 400,
  title,
  subtitle,
  children,
  showBackdrop = true,
  icon,
  variant = 'light',
}: FloatingSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!mounted) return null;

  // Variant-based styling
  const variantStyles = {
    light: {
      sheet: 'bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl',
      header: 'border-slate-200 bg-white/80',
      title: 'text-slate-900',
      subtitle: 'text-slate-500',
      iconBg: 'bg-indigo-100 text-indigo-700',
      closeBtn: 'hover:bg-slate-100 text-slate-500',
    },
    dark: {
      sheet: 'bg-slate-900/95 backdrop-blur-xl border-slate-700 shadow-2xl',
      header: 'border-slate-700 bg-slate-900/80',
      title: 'text-white tracking-wide',
      subtitle: 'text-slate-400 tracking-wide',
      iconBg: 'bg-indigo-500/20 text-indigo-300',
      closeBtn: 'hover:bg-slate-800 text-slate-400',
    },
    'glass-dark': {
      sheet: 'bg-slate-900/75 backdrop-blur-xl border-white/10 shadow-2xl panel-edge-blue',
      header: 'border-white/10 bg-slate-900/60',
      title: 'text-white drop-shadow-lg tracking-wider text-xl',
      subtitle: 'text-indigo-200/80 tracking-wide',
      iconBg: 'bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 text-indigo-100 border border-white/20 shadow-lg',
      closeBtn: 'hover:bg-white/10 text-cyan-200 backdrop-blur-sm border border-white/10',
    },
  };

  const styles = variantStyles[variant];

  const sheetContent = (
    <>
      {/* Backdrop */}
      {showBackdrop && (
        <div
          className={clsx(
            'fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}

      {/* Sheet */}
      <div
        className={clsx(
          'fixed top-0 bottom-0 z-50 flex flex-col',
          styles.sheet,
          'transition-transform duration-300 ease-out',
          side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
          open 
            ? 'translate-x-0' 
            : side === 'left' 
              ? '-translate-x-full' 
              : 'translate-x-full'
        )}
        style={{ width }}
      >
        {/* Glass overlay effect for glass-dark variant */}
        {variant === 'glass-dark' && (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/5 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent_50%)] pointer-events-none" />
          </>
        )}

        {/* Header */}
        <div className={clsx(
          "flex-shrink-0 px-6 py-4 border-b relative z-10",
          styles.header
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 h-full">
              {icon && (
                <div className={clsx(
                  "flex-shrink-0 w-fit p-1 rounded-lg flex items-center justify-center",
                  styles.iconBg
                )}>
                  {icon}
                </div>
              )}
              <div className="min-w-0 h-full ">
                <h2 className={clsx(
                  "text-base font-semibold truncate",
                  styles.title
                )}>
                  {title}
                </h2>
                {subtitle && (
                  <p className={clsx(
                    "text-xs truncate",
                    styles.subtitle
                  )}>{subtitle}</p>
                )}
              </div>
            </div>
            
            <button
              onClick={() => onOpenChange(false)}
              className={clsx(
                "flex-shrink-0 p-1 rounded-lg transition-colors",
                styles.closeBtn
              )}
              aria-label="Close panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          <div className="p-3 mt-0 space-y-4">
            {children}
          </div>
        </div>

        {/* Optional: Resize handle */}
        <div
          className={clsx(
            'absolute top-0 bottom-0 w-1 cursor-col-resize transition-colors z-10',
            variant === 'glass-dark' 
              ? 'hover:bg-cyan-400/50' 
              : 'hover:bg-indigo-400/50',
            side === 'left' ? 'right-0' : 'left-0'
          )}
          aria-hidden="true"
        />
      </div>
    </>
  );

  return createPortal(sheetContent, document.body);
}

// Floating toggle button
interface SheetToggleButtonProps {
  side: 'left' | 'right';
  open: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  offsetTop?: string; // e.g., 'top-24', 'top-36', etc.
}

export function SheetToggleButton({
  side,
  open,
  onClick,
  icon,
  label,
  badge,
  offsetTop = 'top-24',
}: SheetToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'fixed z-30 flex items-center gap-2 px-4 py-2 rounded-xl',
        'bg-white/40 backdrop-blur-lg  shadow-lg ',
        'hover:shadow-xl hover:scale-105',
        'transition-all duration-200',
        'group',
        side === 'left' ? 'left-6' : 'right-6',
        offsetTop
      )}
      aria-label={label}
      aria-expanded={open}
    >
      {/* Icon */}
      <div className={clsx(
        'w-4 h-4 text-slate-600 group-hover:text-indigo-600 transition-colors',
        open && 'text-indigo-600'
      )}>
        {icon}
      </div>

      {/* Label (hidden when open) */}
      <span className={clsx(
        'text-sm font-medium text-slate-700 tracking-wide transition-all duration-200',
        open ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'
      )}>
        {label}
      </span>

      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
          {badge > 9 ? '9+' : badge}
        </span>
      )}

      {/* Open indicator */}
      {open && (
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-full" />
      )}
    </button>
  );
}