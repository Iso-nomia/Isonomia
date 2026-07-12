import "@/app/globals.css";

export const metadata = { title: "Quick Argument Builder | Mesh" };

export default function QuickLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
