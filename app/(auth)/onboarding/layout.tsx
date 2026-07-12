import localFont from "next/font/local";
import "../../globals.css";

const founderslight = localFont({ src: "./NewEdgeTest-LightRounded.otf" });

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body className={`${founderslight.className}`}>
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-r from-zinc-200 via-indigo-300 to-rose-200">
          <section className="w-full max-w-4xl px-6 py-2">
            {children}
          </section>
        </main>
      </body>
    </html>
  );
}
