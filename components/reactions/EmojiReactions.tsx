import { EMOJI_EVENT } from "@/constants";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

type Reaction = { id: string; emoji: string; user: string };

interface Props {
  channel: RealtimeChannel;
  username: string;
}

const MAX_HISTORY = 20;

export default function EmojiReactions({ channel, username }: Props) {
  const [history, setHistory] = useState<Reaction[]>([]);

  useEffect(() => {
    channel
      .on("broadcast", { event: EMOJI_EVENT }, ({ payload }) => {
        const reaction = payload as Reaction;
        setHistory((prev) => {
          const next = [...prev.slice(-MAX_HISTORY + 1), reaction];
          return next;
        });
        setTimeout(() => {
          setHistory((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 3000);
      })
      .subscribe();
  }, [channel]);

  const sendReaction = (emoji: string) => {
    const reaction = { id: crypto.randomUUID(), emoji, user: username };
    channel.send({ type: "broadcast", event: EMOJI_EVENT, payload: reaction });
  };

  return (
    <div className="pointer-events-none">
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2 pointer-events-auto">
        {["👍", "🔥", "🎉"].map((e) => (
          <button
            key={e}
            className="rounded bg-white/80 px-2"
            onClick={() => sendReaction(e)}
          >
            {e}
          </button>
        ))}
      </div>
      {history.map((r) => (
        <div key={r.id} className="absolute bottom-20 left-1/2 -translate-x-1/2 text-3xl animate-bounce">
          {r.emoji}
        </div>
      ))}
    </div>
  );
}
