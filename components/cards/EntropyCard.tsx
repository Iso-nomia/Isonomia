"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseclient";
import { useAuth } from "@/lib/AuthContext";
import { fetchUser } from "@/lib/actions/user.actions";
import { entropyDigits, TileInfo } from "@/lib/entropy/utils";
import { updateRealtimePost } from "@/lib/actions/realtimepost.actions";

interface EntropyCardProps {
  id: string;
  content: string;
  inviteeId: number;
  authorId: number;
}

function EntropyCard({ id, content, inviteeId, authorId }: EntropyCardProps) {
  const { user: currentUser } = useAuth();
  const [secret, setSecret] = useState<string>("SECRET");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [channel, setChannel] = useState<any>(null);
  const [current, setCurrent] = useState("");
  const [otherUsername, setOtherUsername] = useState("");

  useEffect(() => {
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.secret) setSecret(parsed.secret);
        if (Array.isArray(parsed.guesses)) setGuesses(parsed.guesses);
      } catch {}
    }
  }, [content]);

  useEffect(() => {
    const ch = supabase.channel(`entropy-${id}`);
    ch.on("broadcast", { event: "guess" }, ({ payload }) => {
      setGuesses((prev) => [...prev, payload.guess]);
    });
    ch.subscribe();
    setChannel(ch);
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  useEffect(() => {
    if (!currentUser) return;
    const otherId = Number(currentUser.userId) === Number(authorId) ? inviteeId : authorId;
    if (!otherId) return;
    fetchUser(BigInt(otherId)).then((u) => u && setOtherUsername(u.username));
  }, [currentUser, inviteeId, authorId]);

  const sendGuess = async () => {
    if (!channel) return;
    if (current.length !== 6) return;
    channel.send({ type: "broadcast", event: "guess", payload: { guess: current } });
    const updated = [...guesses, current];
    setGuesses(updated);
    setCurrent("");
    await updateRealtimePost({ id, path: "/", content: JSON.stringify({ inviteeId, secret, guesses: updated }) });
  };

  if (
    currentUser &&
    Number(currentUser.userId) !== Number(inviteeId) &&
    Number(currentUser.userId) !== Number(authorId)
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[1rem]">Opponent: {otherUsername || ""}</p>
      <ul className="font-mono text-sm space-y-1">
        {guesses.map((g, i) => {
          const res = entropyDigits(secret, g);
          return (
            <li key={i} className="flex gap-2">
              <span>{g}</span>
              <span>{res.tiles.map(t => t.digit).join(" ")}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 mt-2">
        <input
          value={current}
          onChange={(e) => setCurrent(e.target.value.toUpperCase())}
          className="border p-1 text-black text-sm"
          maxLength={6}
        />
        <button onClick={sendGuess} className="likebutton border-none px-2 rounded">
          Guess
        </button>
      </div>
    </div>
  );
}

export default EntropyCard;
