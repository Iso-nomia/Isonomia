// //app/(root)/(standard)/layout.tsx
// export const dynamic = "force-dynamic";
// import { Inter } from "next/font/google";
// import { Chakra_Petch } from "next/font/google";
// import { Comfortaa } from "next/font/google";
// import { Nunito } from "next/font/google";
// import localFont from "next/font/local";
// import { PrivateChatProvider } from "@/contexts/PrivateChatManager";
// import PrivateChatShell from "@/components/chat/PrivateChatShell";
// import "../../globals.css";
// import Topbar from "@/components/shared/Topbar";
// import LeftSidebar from "@/components/shared/LeftSidebar";
// import RightSidebar from "@/components/shared/RightSidebar";
// import Bottombar from "@/components/shared/Bottombar";
// import { getUserFromCookies } from "@/lib/serverutils";
// import { AuthProvider } from "@/components/shared/AuthProvider";
// import ScrollAnalytics from "@/components/shared/ScrollAnalytics";
// import { getRoomsForUser } from "@/lib/actions/realtimeroom.actions";
// import { RealtimeRoom } from "@prisma/client";
// import ClientProviders from "./client-providers";
// import PrivateChatDock from "@/components/chat/PrivateChatDock";
// import MessagesRealtimeBootstrap from "@/components/chat/MessagesRealtimeBootstrap";
// import { getCurrentUserId } from "@/lib/serverutils";
// import { Toaster } from 'sonner'

// export const metadata = {
//   title: "Mesh",
//   description: "A social media website",
// };

// const founders = localFont({ src: "./NewEdgeTest-RegularRounded.otf" });
// const founderslight = localFont({ src: "./NewEdgeTest-LightRounded.otf" });

// const inter = Inter({ subsets: ["latin"] });
// const nunito = Nunito({ subsets: ["latin"] });

// const chakra = Chakra_Petch({
//   weight: ["400", "500", "700"],
//   subsets: ["latin"],
// });
// const comfortaa = Comfortaa({
//   weight: ["400"],
//   subsets: ["latin"],
// });

// export default async function StandardLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const user = await getUserFromCookies();
//   let userRooms = [] as RealtimeRoom[];
//   if (user && user.userId) {
//     userRooms = await getRoomsForUser({ userId: user!.userId! });
//   } else {
//     userRooms = [];
//   }

//   const isEditor = false;
//   const currentUserId = await getCurrentUserId();
//   return (
//     <html className="bg-gradient-to-r from-zinc-200 from-0% via-indigo-300 via-50% to-rose-200 to-100%">
//       <body className={`${founderslight.className}`}>

//         {/* ONE AuthProvider and ONE ChatManager for the entire app */}
//         <AuthProvider user={user}>
//         <ClientProviders>
//           {/* <PrivateChatShell meId={user?.userId?.toString() ?? null}> */}
//           <Toaster position="top-right" richColors />
        
//             <ScrollAnalytics />
//             <main className="flex flex-row">
//               <LeftSidebar userRooms={userRooms} />
//               <section className="main-container ">
//                 <div className="w-full max-w-4xl">{children}</div>
//               </section>
//               <RightSidebar />
//             </main>
//             </ClientProviders>
//           {/* </PrivateChatShell> */}
//         </AuthProvider>
//       </body>
//     </html>
//   );
// }
export const dynamic = "force-dynamic";
import { Inter } from "next/font/google";
import { Chakra_Petch } from "next/font/google";
import { Comfortaa } from "next/font/google";
import { Nunito } from "next/font/google";
import localFont from "next/font/local";
import "../../globals.css";
import { getUserFromCookies, getCurrentUserId } from "@/lib/serverutils";
import { AuthProvider } from "@/components/shared/AuthProvider";
import ScrollAnalytics from "@/components/shared/ScrollAnalytics";
import { getRoomsForUser } from "@/lib/actions/realtimeroom.actions";
import { RealtimeRoom } from "@prisma/client";
import ClientProviders from "./client-providers";
import { Toaster } from "sonner";
import StandardShell from "./StandardShell"; // 👈 add this
import { SITE_TITLE, SITE_DESCRIPTION, siteIcons } from "@/lib/favicons";

export const metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  icons: siteIcons,
  // Google Search Console (URL-prefix) verification. Set
  // GOOGLE_SITE_VERIFICATION in the environment to the token Search Console
  // gives you; the <meta name="google-site-verification"> tag is emitted only
  // when the token is present. Then use "Request Indexing" to trigger a recrawl.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  // Track B.1 \u2014 discovery hints for LLM agents and AI-citation pipelines.
  alternates: {
    types: {
      "application/json":
        "/.well-known/argument-graph",
      "text/markdown": "/.well-known/llms.txt",
    },
  },
};

const founders = localFont({ src: "./NewEdgeTest-RegularRounded.otf" });
const founderslight = localFont({ src: "./NewEdgeTest-LightRounded.otf" });

const inter = Inter({ subsets: ["latin"] });
const nunito = Nunito({ subsets: ["latin"] });

const chakra = Chakra_Petch({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});
const comfortaa = Comfortaa({
  weight: ["400"],
  subsets: ["latin"],
});

export default async function StandardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserFromCookies();
  let userRooms: RealtimeRoom[] = [];

  if (user?.userId) {
    userRooms = await getRoomsForUser({ userId: user.userId });
  }

  const currentUserId = await getCurrentUserId();

  return (
    <html className="bg-gradient-to-r from-zinc-200 from-0% via-indigo-100 via-50% to-rose-100 to-100%">
      <body className={`${founderslight.className}`}>
        <AuthProvider user={user}>
          <ClientProviders>
            <Toaster position="top-right" richColors />
            <ScrollAnalytics />

            {/* Wrap page content in a client shell that can check the pathname */}
            <StandardShell userRooms={userRooms} isAuthed={!!user?.userId}>
              {children}
            </StandardShell>

          </ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}
