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
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserLite {
  id: string;
  name: string;
  image: string | null;
}

export default function GroupCreationModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced] = useDebounce(query, 300);
  const [results, setResults] = useState<UserLite[]>([]);
  const [selected, setSelected] = useState<UserLite[]>([]);
  const [title, setTitle] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function search() {
      if (!debounced) {
        setResults([]);
        return;
      }
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(debounced)}`);
      if (res.ok) {
        setResults(await res.json());
        
      }
    }
    search();
  }, [debounced]);

  function toggle(user: UserLite) {
    setSelected((prev) => {
      if (prev.some((u) => u.id === user.id)) {
        return prev.filter((u) => u.id !== user.id);
      }
      return [...prev, user];
    });
  }

  async function create() {
    const body = {
      title: title || undefined,
      participantIds: selected.map((u) => u.id),
    };
    const res = await fetch("/api/conversations/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setOpen(false);
      router.push(`/messages/${data.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="savebutton bg-white/30 rounded-xl py-2 px-3 text-[1rem]">Create Group Chat</button>
      </DialogTrigger>
      <DialogContent className="max-w-[45rem]  bg-slate-700 border-blue">
        <DialogHeader>
          <DialogTitle className="text-[1.8rem] text-white tracking-wide ">Create Group</DialogTitle>
        </DialogHeader>
        <hr ></hr>

        <div className="space-y-8 py-4">
          <Input
          className="modalfield text-[1.1rem] tracking-wide p-3"
            placeholder="Group Name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div>
            <Input
                      className="modalfield text-[1.1rem] tracking-wide p-3"

              placeholder="Add Users"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {results.length > 0 && (
              <ul className="max-h-40 overflow-y-auto mt-2 border rounded-md">
                {results.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggle(u)}
                  >
                    <Image
                      src={u.image || "/assets/user-helsinki.svg"}
                      alt={u.name}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                    <span>{u.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="flex items-center gap-1 bg-gray-200 px-2 py-1 rounded-full text-sm"
                >
                  {u.name}
                  <button onClick={() => toggle(u)}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <hr className="mt-1"></hr>
        <button className="mt-1 flex text-center justify-start savebutton rounded-xl bg-white px-5 py-1 text-[1.1rem] tracking-wide w-fit " onClick={create} disabled={selected.length < 2}>
            Create
          </button>
      </DialogContent>
    </Dialog>
  );
}
