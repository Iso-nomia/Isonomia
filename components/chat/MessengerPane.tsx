// components/chat/MessengerPane.tsx
"use client";

import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";

type Participant = { id: string; name: string; image: string | null };
type Conversation = {
  id: string;
  isGroup: boolean;
  title?: string | null;
  participants: Participant[];
  lastMessage?: string | null;
  lastAt?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function GroupAvatar({ participants }: { participants: Participant[] }) {
  const imgs = participants.slice(0, 3);
  return (
    <div className="flex  w-10 h-10 rounded-full overflow-hidden bg-white/50">
      {imgs.map((p) => (
        <Image
          key={p.id}
          src={p.image || "/assets/user-helsinki.svg"}
          alt={p.name}
          width={40}
          height={40}
          className="object-fill"
        />
      ))}
    </div>
  );
}

function Title({ c, currentUserId }: { c: Conversation; currentUserId: string }) {
  if (c.isGroup) {
    const base =
      c.title?.trim() ||
      c.participants
        .map((p) => p.name)
        .slice(0, 3)
        .join(", ");
    const extra = c.participants.length - 3;
    return <span className="font-semibold">{extra > 0 ? `${base} +${extra}` : base || "Group"}</span>;
  }
  const other = c.participants.find((p) => p.id !== currentUserId);
  return <span className="font-semibold">{other?.name ?? "Direct Message"}</span>;
}

export default function MessengerPane({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Load conversations when pane is open the first time
  const { data, isLoading, error, mutate } = useSWR<Conversation[]>(
    open ? "/api/conversations/list" : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  // Close pane on route change (optional)
  const isMessagesPage = useMemo(() => pathname?.startsWith("/messages/"), [pathname]);

  function go(id: string) {
    router.push(`/messages/${id}`);
    setOpen(false);
  }

  return (
    <>
      {/* bottom-left tab button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-[8rem] tracking-wide top-6 z-[9000] rounded-full bg-white/80  px-4 py-1 likebutton"
        >
          ⇤
  Messages
        </button>
      )}

      {/* sliding pane */}
      <div
        className={[
          "fixed left-0 bottom-16 sm:bottom-20 z-[9996] h-[65vh] sm:h-[70vh] w-[22rem] sm:w-[24rem]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-[110%]",
          "pointer-events-auto",
        ].join(" ")}
      >
        <div className="flex h-full flex-col rounded-r-xl border border-slate-200 bg-indigo-50/50 backdrop-blur shadow-xl ">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 rounded-tl-xl w-full rounded-tr-xl">
            <div className="font-semibold text-[1.05rem] tracking-widest px-3">Your Conversations</div>
            <div className="space-x-1">
              <button
                className="rounded px-2 py-1 hover:bg-black/5"
                onClick={() => mutate()} // refresh list
                title="Refresh"
              >
                ⟳
              </button>
              <button
                className="rounded px-2 py-1 hover:bg-black/5"
                onClick={() => setOpen(false)} // minimize to tab
                title="Minimize"
              >
                –
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 ">
            {isLoading && <div className="text-sm text-gray-500 px-2 py-4">Loading…</div>}
            {error && <div className="text-sm text-red-600 px-2 py-4">Failed to load conversations.</div>}
            {data?.length === 0 && <div className="text-sm text-gray-500 px-2 py-4">No conversations yet.</div>}
            <ul className="space-y-2">
              {data?.map((c) => {
                const other = !c.isGroup ? c.participants.find((p) => p.id !== currentUserId) : null;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 p-2 bg-white/70 shadow-md rounded-lg border hover:bg-white cursor-pointer"
                    onClick={() => go(c.id)}
                  >
                    {c.isGroup ? (
                      <GroupAvatar participants={c.participants} />
                    ) : (
                      <Image
                        src={other?.image || "/assets/user-helsinki.svg"}
                        alt={other?.name || "User"}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        <Title c={c} currentUserId={currentUserId} />
                      </div>
                      {c.lastMessage && (
                        <div className="text-sm text-gray-600 truncate">{c.lastMessage}</div>
                      )}
                    </div>

                    {/* optional: timestamp */}
                    {c.lastAt && (
                      <div className="ml-2 shrink-0 text-[11px] text-gray-500">
                        {new Date(c.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* footer (optional shortcut) */}
          <div className="border-t px-3 py-2 bg-white/60 rounded-br-xl">
            <Link href="/profile/messages" className="text-sm underline">
              Open Messages Page
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
