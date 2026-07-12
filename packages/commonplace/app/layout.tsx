import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentAuthor } from "../lib/auth";

export const metadata: Metadata = {
  title: "Commonplace",
  description: "Infrastructure for personal memory",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentAuthor().catch(() => null);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fbf8f1] text-[#2c241b] antialiased">
        <main className="mx-auto max-w-3xl px-3 py-6">
          {ctx && (
            <nav className="mb-6 flex items-center justify-between font-serif text-[#4a3b2c]  text-[16px] ">
              <div className="flex gap-6">
                <Link href="/write" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Write
                </Link>
                <Link href="/read" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Read
                </Link>
                <Link href="/sources" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Sources
                </Link>
                <Link href="/graph" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Graph
                </Link>
                <Link href="/compose" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Compose
                </Link>
                <Link href="/search" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Search
                </Link>
                <Link href="/archive" className="transition-colors duration-200 hover:text-[#8b2500] hover:underline hover:underline-offset-[5px]">
                  Archive
                </Link>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-stone-500 hover:text-stone-900"
                >
                  Sign out
                </button>
              </form>
            </nav>
          )}
          {children}
        </main>
      </body>
    </html>
  );
}
