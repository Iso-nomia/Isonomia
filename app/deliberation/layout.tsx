import '@/app/article.templates.css';   // <— single import
// import './article.global.scss';
import "@/app/article/editor.global.css";
import "@/app/article/rhetoric.css";

import "@/app/article/type-tokens.css";
import '@/app/fonts/fonts.css';
import '@/components/agora/deliberation-styles.css';
import QueryProvider from "@/components/providers/QueryProvider";
import { SITE_TITLE, SITE_DESCRIPTION, siteIcons } from "@/lib/favicons";



export const metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: siteIcons,
}

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex  justify-center items-center align-center  pb-4 h-full w-full  deliberation-bg ">
      <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

