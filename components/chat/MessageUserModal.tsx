// components/chat/MessageUserModal.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDebounce } from "use-debounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type UserLite = {
  id: string;
  name: string;
  username?: string | null;
  image: string | null;
};

export default function MessageUserModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced] = useDebounce(query, 300);
  const [results, setResults] = useState<UserLite[]>([]);
  const [selected, setSelected] = useState<UserLite | null>(null);
  const [firstMessage, setFirstMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!debounced) {
        setResults([]);
        return;
      }
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(debounced)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as UserLite[];
      if (!cancelled) setResults(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  function pick(u: UserLite) {
    setSelected(u);
    setQuery(`${u.name}${u.username ? ` (@${u.username})` : ""}`);
    setResults([]); // close list
  }

  async function handleSend() {
    setError(null);
    if (!selected) {
      setError("Please select a user to message.");
      return;
    }

    // 1) Create (or fetch) the DM conversation
    const res = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: selected.id }),
    });

    if (res.status === 403) {
      setError("This user only accepts messages from friends.");
      return;
    }
    if (!res.ok) {
      setError("Could not start a conversation.");
      return;
    }

    const { id } = await res.json();

    // 2) Optionally send the first message
    const text = firstMessage.trim();
    if (text) {
      const form = new FormData();
      form.append("text", text);
      await fetch(`/api/messages/${id}`, { method: "POST", body: form });
    }

    // 3) Go to the conversation
    setOpen(false);
    setSelected(null);
    setFirstMessage("");
    setQuery("");
    router.push(`/messages/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Enter picks the first result if nothing selected yet
      if (!selected && results.length > 0) {
        e.preventDefault();
        pick(results[0]);
      }
    }
  }

  //   useEffect(() => {
  //     async function search() {
  //       if (!debounced) {
  //         setResults([]);
  //         return;
  //       }
  //       const res = await fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`);
  //       if (res.ok) {
  //         setResults(await res.json());

  //       }
  //     }
  //     search();
  //   }, [debounced]);

  //   function toggle(user: UserLite) {
  //     setSelected((prev) => {
  //       if (prev.some((u) => u.id === user.id)) {
  //         return prev.filter((u) => u.id !== user.id);
  //       }
  //       return [...prev, user];
  //     });
  //   }

  //   async function create() {
  //     const body = {
  //       title: title || undefined,
  //       participantIds: selected.map((u) => u.id),
  //     };
  //     const res = await fetch("/api/conversations/group", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(body),
  //     });
  //     if (res.ok) {
  //       const data = await res.json();
  //       setOpen(false);
  //       router.push(`/messages/${data.id}`);
  //     }
  //   }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setSelected(null);
          setFirstMessage("");
          setResults([]);
          setQuery("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button className="savebutton bg-white/30 rounded-xl py-2 px-3 text-[1rem]">
          Send Direct Message
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[45rem]  bg-slate-700 border-blue">
        <DialogHeader>
          <DialogTitle className="text-[1.8rem] text-white tracking-wide ">
            New Message
          </DialogTitle>
        </DialogHeader>
        <hr></hr>

        <div className="space-y-8 py-4">
          <div>
            <Input
              className="modalfield text-[1.1rem] tracking-wide p-3"
              placeholder="Search by name or @username"
              
              
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              onKeyDown={onKeyDown}
                          />
            {results.length > 0 && (
              <ul className="max-h-40 overflow-y-auto mt-2 border rounded-md">
                {results.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => pick(u)}
                                      >
                    <Image
                      src={u.image || "/assets/user-helsinki.svg"}
                      alt={u.name}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{u.name}</div>
                      {u.username && <div className="text-xs text-gray-500">@{u.username}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Input
                 className="modalfield text-[1.05rem] tracking-wide p-3"
                 placeholder="Write a message…"
                 value={firstMessage}
                 onChange={(e) => setFirstMessage(e.target.value)}
          />


{selected && (
            <div className="text-white/90 text-sm">
              Sending to <span className="font-semibold">{selected.name}</span>
              {selected.username ? ` (@${selected.username})` : ""}
            </div>
          )}
 {error && <div className="text-red-300 text-sm">{error}</div>}
        </div>

        <div className="flex justify-start">
          <button
            onClick={handleSend}
            disabled={!selected}
            className="rounded-xl bg-white px-5 py-1 savebutton text-[1.05rem] tracking-wide"
          >
            Send
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

//           {selected.length > 0 && (
//             <div className="flex flex-wrap gap-2">
//               {selected.map((u) => (
//                 <span
//                   key={u.id}
//                   className="flex items-center gap-1 bg-gray-200 px-2 py-1 rounded-full text-sm"
//                 >
//                   {u.name}
//                   <button onClick={() => toggle(u)}>×</button>
//                 </span>
//               ))}
//             </div>
//           )}
//         </div>
//         <hr className="mt-1"></hr>
//         <button
//           className="mt-1 flex text-center justify-start savebutton rounded-xl bg-white px-5 py-1 text-[1.1rem] tracking-wide w-fit "
//           onClick={create}
//           disabled={selected.length < 2}
//         >
//           Send
//         </button>
//       </DialogContent>
//     </Dialog>
//   );
// }
