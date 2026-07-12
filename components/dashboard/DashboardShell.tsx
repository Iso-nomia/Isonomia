// "use client";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import { ReactNode } from "react";

// const links = [
//   { href: "items", label: "Items" },
//   { href: "orders", label: "Orders" },
//   { href: "payouts", label: "Payouts" },
//   { href: "live", label: "Live" },
// ];

// export function DashboardShell({ children }: { children: ReactNode }) {
//   const pathname = usePathname();
//   return (
//     <div className="flex">
//       <nav className="w-40 p-4 border-r">
//         <ul className="space-y-2">
//           {links.map(l => (
//             <li key={l.href}>
//               <Link
//                 href={l.href}
//                 className={pathname.endsWith(l.href) ? "font-bold" : undefined}
//               >
//                 {l.label}
//               </Link>
//             </li>
//           ))}
//         </ul>
//       </nav>
//       <main className="flex-1 p-4">{children}</main>
//     </div>
//   );
// }


'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export const links = [
  { href: 'items',   label: 'Items' },
  { href: 'orders',  label: 'Orders' },
  { href: 'payouts', label: 'Payouts' },
  { href: 'live',    label: 'Live' },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <nav className="w-48 shrink-0 border-r ml-8 mt-8">
        <ul className="space-y-6">
          {links.map(l => (
            <li key={l.href}>
              <button className='likebutton rounded-xl'>
              <Link
                href={l.href}
                className={`
                  block rounded px-2 py-1
                  ${pathname?.endsWith(l.href) ? 'font-bold bg-gray-100' : 'text-gray-700'}
                `}
              >
                {l.label}
              </Link>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-1 p-6 space-y-4 overflow-y-auto">{children}</main>
    </div>
  );
}
