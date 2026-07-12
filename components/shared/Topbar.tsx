"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut, getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { app } from "@/lib/firebase/firebase";
import { useAuth } from "@/lib/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { Chakra_Petch } from "next/font/google";
import localFont from 'next/font/local'

const parabole = localFont({ src: './Parabole-DisplayRegular.woff2' })


const chakra = Chakra_Petch({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

function Topbar() {
  const router = useRouter();
  const user = useAuth();
  const isUserSignedIn = !!user.user;

  async function handleLogout() {
    await signOut(getAuth(app));
    await fetch("/api/logout");
    router.push("/login");
  }
  return (
    <nav className="topbar    ">
      {isUserSignedIn && (
        <div className="flex items-center gap-1">
          <div className="block md:hidden">
            <Button variant="outline" onClick={handleLogout}>
              <div className="flex cursor-pointer">
                <Image
                  src="/assets/logout.svg"
                  alt="logout"
                  width={24}
                  height={24}
                />
              </div>
            </Button>
          </div>
        </div>
      )}
      <div className="fixed top-[1rem]  justify-start ">
      <Link href="/" className="flex items-center gap-4">
        <Image src="/assets/logo-black.svg" alt="logo" width={36} height={36} />
        <div className={`${parabole.className}`}>
        <span  className=" text-[2.5rem] font-bold text-black tracking-[.0rem] max-xs:hidden">MESH</span>
        </div>

      </Link>
      <NotificationBell />
      </div>

    </nav>
  );
}

export default Topbar;
