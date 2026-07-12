'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import LeftSidebar from '@/components/shared/LeftSidebar';
import RightSidebar from '@/components/shared/RightSidebar';
import type { RealtimeRoom } from '@prisma/client';

function shouldHideSidebars(pathname: string) {
  // Add any paths here that should hide both sidebars.
  // Example: /discussions/[id]
  const patterns = [
    /^\/discussions\/[^/]+$/, // matches /discussions/<id>
  ];

  const matches = patterns.some((p) => p.test(pathname));
  return {
    left: matches,
    right: matches,
  };
}

export default function StandardShell({
  children,
  userRooms,
  isAuthed = true,
}: {
  children: React.ReactNode;
  userRooms: RealtimeRoom[];
  isAuthed?: boolean;
}) {
  const pathname = usePathname();

  // Logged-out visitors only ever reach this shell on the public homepage
  // landing (every other standard route is auth-gated in middleware). Render
  // the page bare so the marketing landing fills the viewport without the
  // app's sidebars.
  if (!isAuthed) {
    return <>{children}</>;
  }

  const hide = shouldHideSidebars(pathname ?? "");

  return (
    <main className="flex flex-row">
      {!hide.left && <LeftSidebar userRooms={userRooms} />}
      <section className="main-container">
        <div className="w-full px-5 ">{children}</div>
      </section>
      {!hide.right && <RightSidebar />}
    </main>
  );
}
