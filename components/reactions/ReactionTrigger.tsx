'use client';

import * as React from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { ReactionBar } from './ReactionBar';
import Image from 'next/image';
export function ReactionTrigger({
  conversationId,
  messageId,
  userId,
  activeFacetId,
  className,
}: {
  conversationId: string;
  messageId: string;
  userId: string;
  activeFacetId?: string | null;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const longTimer = React.useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') {
      longTimer.current = window.setTimeout(() => setOpen(true), 350);
    }
  };
  const clearLong = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
        <div className='flex '>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={clearLong}
          onPointerCancel={clearLong}
          onClick={() => setOpen((v) => !v)} // desktop click
          className={['rounded-full flex flex-col align-center my-auto   w-fit h-fit sheaf-bubble bg-white/30', className]
            .filter(Boolean)
            .join(' ')}
          title="React"
        >
           <Image
                src="/assets/overflow-menu--horizontal.svg"
                alt="share"
                width={14}
                height={14}
                className="cursor-pointer object-contain"
              />
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" sideOffset={6} className="p-2">
        <ReactionBar
          conversationId={conversationId}
          messageId={messageId}
          userId={userId}
          activeFacetId={activeFacetId ?? null}
        />
      </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}
