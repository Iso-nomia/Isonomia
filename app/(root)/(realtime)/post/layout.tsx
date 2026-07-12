import { Chakra_Petch } from "next/font/google";
import "../../../globals.css";
import Topbar from "@/components/shared/Topbar";
import LeftSidebar from "@/components/shared/LeftSidebar";
import RightSidebar from "@/components/shared/RightSidebar";
import Bottombar from "@/components/shared/Bottombar";
import { getUserFromCookies } from "@/lib/serverutils";
import { AuthProvider } from "@/components/shared/AuthProvider";
import { getRoomsForUser } from "@/lib/actions/realtimeroom.actions";
import { RealtimeRoom } from "@prisma/client";

export const metadata = {
  title: "Isonomia",
  description: "Isonomia turns an argument into structured, verifiable data instead of prose. Today the reasoning behind a decision lives buried inside documents: a web page mixes the claim, the evidence, the rhetoric, and a great deal of unstated assumption into one blob, and if you want to cite it, you cite the whole page. Isonomia breaks that apart. A claim or an argument becomes its own object with a permanent address, carrying what supports it, the sources behind it that are fetched, timestamped, and verifiable, so the record holds even if the original link later rots, the strongest objection on file against it, and whether it has survived challenge. The result is something a person or an AI system can cite precisely, trace to its origin, and check, rather than re-reading and re-judging a document every time.",
};

export const dynamic = "force-dynamic";

const chakra = Chakra_Petch({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export default async function StandardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserFromCookies();
  let userRooms: RealtimeRoom[] = [];
  if (user && user.userId) {
    userRooms = await getRoomsForUser({ userId: user.userId });
  }
  return (
    <html>
      <body className={`${chakra.className} bg-[#311e3e]`}>
        <AuthProvider user={user}>
          <main className="flex flex-row">
            <LeftSidebar userRooms={userRooms} />
            <section className="main-container">
              <div className="w-full max-w-4xl">
                <AuthProvider user={user}>{children}</AuthProvider>
              </div>
            </section>
            <RightSidebar />
          </main>
          <Bottombar />
        </AuthProvider>
      </body>
    </html>
  );
}
