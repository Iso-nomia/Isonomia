import '@/app/globals.css';
import '@/app/article.templates.css';   // <— single import
// import './article.global.scss';
import "./editor.global.css";
import '@/app/fonts/fonts.css';
import "@/app/article/type-tokens.css";



export const metadata = { title: 'Write an article' };

export default function EditorLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Tailwind 'h-screen' makes the editor fill the viewport */}
      <body className="h-full w-full overflow-auto bg-slate-300 mt-8">
        {children}
      </body>
    </html>
  );
}

