import '@/app/globals.css';
import '@/app/article.templates.css';   // <— single import
import '@/app/fonts/fonts.css';
import "@/app/article/type-tokens.css";

// Wrapper for the /about route and its sub-pages (details, landing,
// onboarding). Page-level metadata + JSON-LD live in each page.tsx so
// they don't cascade onto the sub-routes.
export default function AboutLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 m-0 p-0 overflow-auto">
      {children}
    </div>
  );
}
