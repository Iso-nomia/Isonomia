import "@/app/globals.css";

export const metadata = {
  title: "Mesh",
  description: "A social media website",
};

export default function LedgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
