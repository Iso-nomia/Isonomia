"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import CreateLoungePost from "@/components/forms/CreateLoungePost";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "@/lib/AuthContext";


import { app } from "@/lib/firebase/firebase";
import { RealtimeRoom } from "@prisma/client";

import CreateFeedPost from "@/components/forms/CreateFeedPost";
import localFont from "next/font/local";


const parabole = localFont({ src: './Parabole-DisplayRegular.woff2' })

interface SuggestedUser {
  id: number;
  name: string | null;
  username: string;
  image: string | null;
  score?: number;
  overlap?: Record<string, string[]>;
}

interface RandomRoom {
  id: string;
  room_icon: string;
}
const isOff = true;

function RightSidebar() {
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [rooms, setRooms] = useState<RandomRoom[]>([]);
  const router = useRouter();
  const user = useAuth();
  const isUserSignedIn = !!user.user;
  const pathname = usePathname();
  const loungeMatch = pathname?.match(/^\/lounges\/([^/]+)/);
  const loungeId = loungeMatch ? loungeMatch[1] : null;

  async function handleLogout() {
    await signOut(getAuth(app));
    await fetch("/api/logout");
    router.push("/login");
  }
  function gotomessages() {
    router.push("/profile/messages");
  }
  function gotosettings() {
    router.push("/profile/settings");
  }
  function gotosearch() {
    router.push("/search");
  }
  function newlounge() {
    router.push("/create-lounge");
  }
  function newroom() {
    router.push("/create-room");
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/suggested-friends");
        if (res.ok) {
          const data = await res.json();
          console.log("suggestions", data);
          setUsers(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (!isOff) load();
  }, []);

  useEffect(() => {
    async function loadRooms() {
      try {
        const res = await fetch("/api/random-rooms?count=4");
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (!isOff) loadRooms();
  }, []);
  // return (
  // <section className="custom-scrollbar rightsidebar">
  //     <div className="flex flex-1 flex-col justify-start">
  //         <h3 className="text-heading4-medium text-light-1">Discover Groups</h3>
  //     </div>
  //     <div className="flex flex-1 flex-col justify-start">
  //         <h3 className="text-heading4-medium text-light-1">Discover Users</h3>
  //     </div>
  // </section>
  // )

  if (isOff) {
    return (
      <section className="sticky custom-scrollbar rightsidebar bg-transparent">
        <div className="flex   w-full flex flex-col gap-6 px-2 mt-3">
          {loungeId && <CreateLoungePost roomId={loungeId} />}

          <button
            className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
            onClick={newlounge}
          >
            <div className="flex align-center gap-3">
              <Image
                src="/assets/group--resource.svg"
                alt={"lounge"}
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                New Lounge
              </div>
            </div>
          </button>
          <button
            className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
            onClick={newroom}
          >
            <div className="flex align-center gap-3">
              <Image
                src="/assets/gateway.svg"
                alt="Create"
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                New Room
              </div>
            </div>
          </button>
          <button
            className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
            onClick={gotomessages}
          >
            <div className="flex align-center gap-3">
              <Image
                src="/assets/message-queue.svg"
                alt={"message"}
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                Messages
              </div>
            </div>
          </button>
          

          <button className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent">
            <div className="flex align-center gap-3">
              <Image
                src="/assets/members.svg"
                alt={"members"}
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                Find Users
              </div>
            </div>
          </button>
          <button className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent">
            <div className="flex align-center gap-3">
              <Image
                src="/assets/group--access.svg"
                alt={"multiple-users"}
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                Find Groups
              </div>
            </div>
          </button>
          <button
            className="flex  bubblebutton leftsidebar_link align-center leftsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
            onClick={gotosettings}
          >
            <div className="flex align-center gap-3">
              <Image
                src="/assets/settings.svg"
                alt={"settings"}
                className="flex align-center"
                width={24}
                height={24}
              />
              <div
                className="flex  justify-center items-center text-center tracking-wider 
          py-0 align-center text-black text-[1rem] h-full w-full  max-lg:hidden"
              >
                Settings
              </div>
            </div>
          </button>
          {isUserSignedIn && (
           <button
           className="mt-[5rem] flex  bubblebutton  rightsidebar_link align-center rightsidebar-item items-start justify-start h-full px-4 py-3 rounded-xl border-[1px] border-transparent"
           onClick={handleLogout}
     >
        <div className="flex align-center gap-3">
            <Image
              src="/assets/logout-ibm.svg"
              alt="logout"
              className="flex align-center"
              width={24}
              height={24}
            />
            <div className="flex  justify-center items-center text-center tracking-wider py-0 align-center text-black 
                    text-[1rem] h-full w-full  max-lg:hidden">Sign Out</div>
              </div>
            </button>
        )}
        </div>
        <div className="absolute justify-start  top-[1.55rem] right-12 ">
      <Link href="/" className="flex items-center gap-2">
        {/* <Image src="/assets/logo-black.svg" alt="logo" width={36} height={36} />  */}
        <div className={`${parabole.className}`}>
        <span  className=" text-[2.9rem] font-bold text-black tracking-tighter max-xs:hidden">MESH</span>
        </div>

      </Link>
      
      </div>
        <div className="absolute left-0 top-0 h-full w-[.1rem] bg-gradient-to-tr from-transparent via-rose-300 to-transparent opacity-50 dark:via-neutral-400 lg:block" />
        {/* <h3 className="relative bottom-[4rem] text-[1.5rem] text-black">Right Sidebar</h3> */}
      </section>
    );
  }

  return (
    <section className="sticky custom-scrollbar rightsidebar  bg-transparent">
      <div className="sticky flex w-full flex-1 flex-col gap-2 px-2 mt-[-1rem]">
        <h3 className="relative bottom-[4rem] text-[1.5rem] text-black">
          Find New Groups
        </h3>
        <div className="relative bottom-[4rem] flex flex-col gap-y-4 items-center">
          {rooms.length === 0 ? (
            <p className="text-sm text-gray-500">No rooms</p>
          ) : (
            rooms.map((r) => (
              <Link key={r.id} href={`/room/${r.id}`}>
                <Button
                  variant={"outline"}
                  className="rounded-lg  sidebarbutton items-center justify-center bg-transparent outline-blue border-none"
                >
                  {r.id}
                </Button>
              </Link>
            ))
          )}
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col gap-2 px-2">
        <h3 className="relative bottom-[4.4rem] text-[1.5rem] text-black">
          Find New Users
        </h3>
        <div className="relative bottom-[4.4rem] flex flex-col gap-y-4 items-center">
          {users.length === 0 ? (
            <p className="text-sm text-gray-500">No suggestions</p>
          ) : (
            users.map((u) => (
              <Link key={u.id.toString()} href={`/profile/${u.id}`}>
                <Button
                  variant={"outline"}
                  className="rounded-lg  sidebarbutton items-center justify-center bg-transparent outline-blue border-none"
                >
                  {u.name}
                  {u.score !== undefined && (
                    <span className="ml-2 text-xs text-gray-600">
                      {u.score.toFixed(2)}
                    </span>
                  )}
                </Button>
              </Link>
            ))
          )}
         
        </div>
        
      </div>
      <div className="absolute justify-start  top-[1.55rem] left-[2.7rem]"></div>
      <div className="absolute left-0 top-0 h-full min-h-[1em] w-[.1rem] border-t-0 bg-gradient-to-tr from-transparent via-rose-300 to-transparent opacity-50 dark:via-neutral-400 lg:block"></div>
    </section>
  );
}

export default RightSidebar;
