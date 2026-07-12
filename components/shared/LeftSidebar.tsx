//components/shared/LeftSidebar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { app } from "@/lib/firebase/firebase";
import { RealtimeRoom } from "@prisma/client";
import { getAuth, signOut } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CreateFeedPost from "@/components/forms/CreateFeedPost";
import localFont from "next/font/local";

const parabole = localFont({ src: './Parabole-DisplayRegular.woff2' })

interface Props {
  userRooms: RealtimeRoom[];
}
 
function LeftSidebar({ userRooms }: Props) {
  const router = useRouter();
  const user = useAuth();
  const isUserSignedIn = !!user.user;

  async function handleLogout() {
    await signOut(getAuth(app));
    await fetch("/api/logout");
    router.push("/login");
  }
  function goHome()
  {
    router.push("/");
  }
  function gotoprofile() {
    if (user.user?.userId) {
      router.push(`/profile/${user.user.userId}`);
    } else {
      router.push("/onboarding");
    }  }
    function gotoglobal()
    {
      router.push("/room/global");

    }
    function gotosearch() {
      router.push("/search");
    }
    function newroom()
    {
      router.push("/create-room");

    }
    function gotoapplications()
    {
      router.push("/applications");

    }
    function gotonotifications() {
      router.push("/notifications");
    }
  return (
    <section className="custom-scrollbar leftsidebar  bg-transparent">
      <div>
      <div className="flex  w-full flex flex-col gap-6 px-2 mt-3">
       
            <button
              className="flex bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
              onClick={gotoglobal}
              >
                          <div className="flex align-center gap-3">
                <Image
                  src="/assets/earth--filled.svg"
                  alt={"globe"}
                  className="flex align-center"

                  width={24}
                  height={24}
                />
              <div className="flex  justify-center items-center text-center tracking-wider py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden">Global</div>
              </div>
            </button>
       
            <button
              className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
          onClick={gotoapplications}
        >
                                    <div className="flex align-center gap-3">

          <Image
            src="/assets/apps.svg"
            alt="Create"
            className="flex align-center"

            width={24}
            height={24}
          />
                    <div className="flex  justify-center items-center text-center tracking-wider py-0 align-center text-black 
                    text-[1rem] h-full w-full  max-lg:hidden">Apps</div>
              </div>
            </button>


        {isUserSignedIn && <CreateFeedPost />}
        <button
            className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
            onClick={gotosearch}
          >
            <div className="flex align-center gap-3">
              <Image
                src="/assets/search-helsinki.svg"
                alt={"search"}
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                Search
              </div>
            </div>
          </button>
 
        {isUserSignedIn && (
          <button
          className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
          onClick={gotonotifications}
    >
       <div className="flex align-center gap-3">
            <Image
              src="/assets/notification.svg"
              alt="notifs"
              className="flex align-center"
              width={24}
              height={24}
            />
            <div className="flex  justify-center items-center text-center tracking-wider py-0 align-center text-black 
                    text-[1rem] h-full w-full  max-lg:hidden">Updates</div>
              </div>
            </button>
        )}
  
        {isUserSignedIn && (
          <button
          className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
          onClick={gotoprofile}
    >
       <div className="flex align-center gap-3">
            <Image
              src="/assets/user--avatar.svg"
              alt="profile"
              className="flex align-center"
              width={24}
              height={24}
            />
            <div className="flex  justify-center items-center text-center tracking-wider py-0 align-center text-black 
                    text-[1rem] h-full w-full  max-lg:hidden">Profile</div>
              </div>
            </button>
        )}
    

        
      </div>
     </div>

      <div className="absolute justify-center border-[2px] modalfield p-2 rounded-full border-black w-[5.5rem] h-[5.5rem] top-3 left-12  ">
      <Link href="/" className="flex ">
        <Image src="/assets/roughlogo.svg" alt="logo" width={36} height={36} className="w-fit h-fit "/> 
        {/* <div className={`${parabole.className}`}> */}
        {/* <span  className=" text-[2.5rem] font-bold text-black max-xs:hidden">MESH</span> */}
        {/* </div> */}

      </Link>
      
      </div>
      <div
      className="absolute right-0 top-0 h-full min-h-[1em] w-[.1rem] border-t-0 bg-gradient-to-tr from-transparent via-indigo-300 to-transparent opacity-50 dark:via-neutral-400 lg:block">
  </div>
    </section>
  );
}

export default LeftSidebar;
