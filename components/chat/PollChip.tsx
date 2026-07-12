  /* components/chat/PollChip.tsx */
  "use client";
  import * as React from "react";
  import { PollUI } from "@/contexts/useChatStore";
  
  type VoteBody = { optionIdx?: number; value?: number };

  function leadingIndices(votes: number[]) {
    const max = Math.max(0, ...votes);
    if (max <= 0) return [];
    const out: number[] = [];
    votes.forEach((v, i) => { if (v === max) out.push(i); });
    return out;
  }
  
  function SmallMeta({ children }: { children: React.ReactNode }) {
    return <div className="text-[11px] leading-4 text-slate-600">{children}</div>;
  }
  function MediumMeta({ children }: { children: React.ReactNode }) {
    return <div className="text-[1rem] leading-4 text-slate-700">{children}</div>;
  }
  
  function SummaryButton({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col justify-center   items-center mx-auto w-fit gap-2 px-2 py-2 rounded-xl  bg-white/70  text-[.85rem] sendbutton"
        aria-expanded={false}
      >
        {label}
      </button>
    );
  }
  
  export default function PollChip({
    poll,
    onVote,
  }: {
    poll: PollUI;
    onVote: (params: VoteBody) => void;
  }) {
    const pollId = poll.poll.id;
    const key = React.useMemo(() => `poll:collapsed:${pollId}`, [pollId]);
    const voted =
      poll.kind === "OPTIONS" ? poll.myVote != null : poll.myValue != null;
  
    // Default: not voted → expanded; voted → collapsed
    const [collapsed, setCollapsed] = React.useState<boolean>(voted);
  
    // Hydrate from localStorage (if user toggled before)
    React.useEffect(() => {
      try {
        const v = localStorage.getItem(key);
        if (v !== null) setCollapsed(v === "1");
        else setCollapsed(voted);
      } catch {}
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
  
    // If user just voted and we have no stored pref yet, collapse by default
    const prevVoted = React.useRef(voted);
    React.useEffect(() => {
      if (!prevVoted.current && voted) {
        try {
          const hadPref = localStorage.getItem(key);
          if (hadPref === null) {
            localStorage.setItem(key, "1");
            setCollapsed(true);
          }
        } catch {}
      }
      prevVoted.current = voted;
    }, [voted, key]);
  
    const persist = (v: boolean) => {
      setCollapsed(v);
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {}
    };
  
    // If user hasn't voted yet, keep the current UI (never collapsed)
    if (!voted) {
      return poll.kind === "OPTIONS" ? (
        <OptionsVoteView poll={poll} onVote={onVote} />
      ) : (
        <TempVoteView poll={poll} onVote={onVote} />
      );
    }
  
    // Collapsed: show a compact summary button
    if (collapsed) {
      const label =
        poll.kind === "OPTIONS"
          ? optionsSummaryLabel(poll)
          : `🌡 View temperature • Avg ${poll.avg} (${poll.count})`;
      return <SummaryButton label={label} onClick={() => persist(false)} />;
    }
  
    // Expanded: show results with a small “×” to minimize
    return poll.kind === "OPTIONS" ? (
      <OptionsResultsView poll={poll} onVote={onVote} onClose={() => persist(true)} />
    ) : (
      <TempResultsView poll={poll} onVote={onVote} onClose={() => persist(true)} />
    );
  }
  
  /* ---------- OPTIONS ---------- */
  
  // function optionsSummaryLabel(p: Extract<PollUI, { kind: "OPTIONS" }>) {
  //   const { totals, count } = p;
  //   if (!p.poll.options?.length) return "📊 View poll results";
  //   const total = Math.max(1, count);
  //   let leader = 0;
  //   for (let i = 1; i < p.poll.options.length; i  ++) {
  //     if ((totals[i] ?? 0) > (totals[leader] ?? 0)) leader = i;
  //   }
  //   const pct = Math.round(((totals[leader] ?? 0) * 100) / total);
  //   return `📊 View poll • ${count} vote${count === 1 ? "" : "s"} • Leading: “${
  //     p.poll.options[leader]
  //   }” (${pct}%)`;
  // }
  function optionsSummaryLabel(p: Extract<PollUI, { kind: "OPTIONS" }>) {
    const { totals, count } = p;
    const options = p.poll.options ?? [];
    if (!options.length) return "📊 View poll results";
  
    const totalVotes = Math.max(1, count);
    const votes = options.map((_, i) => totals[i] ?? 0);
    const max = Math.max(0, ...votes);
  
    // Find all indices tied for the lead
    const leaders = votes.reduce<number[]>((acc, v, i) => {
      if (v === max) acc.push(i);
      return acc;
    }, []);
  
    // If there’s a real tie (>=2 leaders) and at least one vote has been cast
    if (max > 0 && leaders.length >= 2) {
      return `📊 View poll • ${count} vote${count === 1 ? "" : "s"} • Leading: tie`;
    }
  
    // Otherwise show the leading option + its percentage
    const leader = leaders[0] ?? 0;
    const pct = Math.round(((votes[leader] ?? 0) * 100) / totalVotes);
    return `📊 View poll • ${count} vote${count === 1 ? "" : "s"} • Leading: “${options[leader]}” (${pct}%)`;
  }
  
  
  function OptionsVoteView({
    poll,
    onVote,
  }: {
    poll: Extract<PollUI, { kind: "OPTIONS" }>;
    onVote: (b: VoteBody) => void;
  }) {
    const { poll: p } = poll;
    const [submitting, setSubmitting] = React.useState<number | null>(null);
    const handle = async (idx: number) => {
      try {
        setSubmitting(idx);
        await onVote({ optionIdx: idx });
      } finally {
        setSubmitting(null);
      }
    };
    return (

      <div className="relative text-[1rem] rounded-xl text-center bg-white/30 px-8 py-4 shadow-xl mx-auto w-[50%] gap-2 ">
        <MediumMeta >📊 Poll · Choose One</MediumMeta>
        <div className="mt-4  justify-center items-center flex flex-wrap gap-4">
          {p.options!.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => handle(idx)}
              disabled={submitting !== null}
              className="px-3 pt-1 text-[1rem] tracking-wide rounded-full  bg-white/70 sendbutton text-xs transition disabled:opacity-60"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }
  
  function OptionsResultsView({
    poll,
    onVote,
    onClose,
  }: {
    poll: Extract<PollUI, { kind: "OPTIONS" }>;
    onVote: (b: VoteBody) => void;
    onClose: () => void;
  }) {
    const { poll: p, totals, count, myVote } = poll;
    const total = Math.max(1, count);

      // tie detection for expanded view
  const votes = p.options!.map((_, i) => totals[i] ?? 0);
  const leaders = leadingIndices(votes);
  const isTie = leaders.length >= 2;

    const handle = async (idx: number) => {
      await onVote({ optionIdx: idx });
    };

    return (
      <div
        className="relative rounded-xl bg-white/30 px-8 py-4 shadow-xl mx-auto w-[70%]"
        role="group"
        aria-label="Poll results"
      >
        <button
          type="button"
          aria-label="Minimize poll"
          onClick={onClose}
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-700"
        >
          ｘ

        </button>
        <div className="flex text-[1rem] text-center justify-between items-baseline">
          <SmallMeta>📊 Poll · {count} vote{count === 1 ? "" : "s"}
          {isTie ? " · Leading: tie" : null}
          </SmallMeta>
        </div>
        <div className="mt-1.5 space-y-1.5">
          {p.options!.map((opt, idx) => {
            const pct = Math.round(((totals[idx] ?? 0) * 100) / total);
            const mine = myVote === idx;
            const isLeader = leaders.includes(idx);
          const showTieBadge = isTie && isLeader;

            return (
              <button key={idx} onClick={() => handle(idx)} className="block w-full text-left" aria-pressed={mine}
              aria-label={
                showTieBadge
                  ? `${opt}, ${pct} percent, tied for lead`
                  : `${opt}, ${pct} percent`
              }>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className={mine ? "font-semibold" : ""}>
                    {mine ? "✓ " : ""}
                    {opt}
                    {showTieBadge && (
                    <span
                      className="ml-2 align-middle rounded-full px-1.5 py-0.5 text-[10px] bg-amber-200/70 text-amber-900"
                      aria-hidden="true"
                    >
                      tie
                    </span>
                     )}
                  </span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded bg-slate-300 overflow-hidden">
                <div
                  className={[
                    "h-1.5 rounded transition-all duration-300",
                    mine
                      ? "bg-indigo-500"
                      : showTieBadge
                      ? "bg-amber-400"
                      : "bg-rose-400",
                  ].join(" ")}
                  style={{ width: `${pct}%` }}
                />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  
  /* ---------- TEMPERATURE ---------- */
  function TempVoteView({
    poll,
    onVote,
    framed = true, // ⬅️ new prop
  }: {
    poll: Extract<PollUI, { kind: "TEMP" }>;
    onVote: (b: VoteBody) => void;
    framed?: boolean;
  }) {
    const { myValue } = poll;
    const [value, setValue] = React.useState<number>(myValue ?? 50);
    const [dragging, setDragging] = React.useState(false);
    const [pending, setPending] = React.useState(false);
  
    const commit = async (v: number) => {
      setPending(true);
      try {
        await onVote({ value: v });
      } finally {
        setPending(false);
      }
    };
  
    const Inner = (
      <>
        <div className="flex items-baseline justify-between">
          <SmallMeta>🌡 Temperature check</SmallMeta>
        </div>
  
        <div className="mt-2">
          <div className="relative">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              onPointerDown={() => setDragging(true)}
              onPointerUp={() => { setDragging(false); commit(value); }}
              className="w-full"
              aria-label="Set your temperature"
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-600">
            <span>0 · Nope</span><span>50 · Meh</span><span>100 · Yes</span>
          </div>
        </div>
  
        <div className="mt-1 text-[11px] text-slate-700">
          Your value: <span className="tabular-nums">{value}</span>
          {pending ? " • saving…" : dragging ? " • release to save" : null}
        </div>
      </>
    );
  
    if (!framed) return Inner;
  
    return (
      <div
        className="relative rounded-xl bg-white/30 px-8 py-4 shadow-xl mx-auto w-[70%]"
        role="group"
        aria-label="Temperature Check"
      >
        {Inner}
      </div>
    );
  }
  
  
  function TempResultsView({
    poll,
    onVote,
    onClose,
  }: {
    poll: Extract<PollUI, { kind: "TEMP" }>;
    onVote: (b: VoteBody) => void;
    onClose: () => void;
  }) {
    const { avg, count } = poll;
  
    return (
      <div
        className="relative rounded-xl bg-white/30 px-8 py-4 shadow-xl mx-auto w-[70%]"
        role="group"
        aria-label="Temperature results"
      >
        <button
          type="button"
          aria-label="Minimize poll"
          onClick={onClose}
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-700"
        >
          ｘ

        </button>
  
        <div className="mb-1 flex items-baseline justify-between">
          <SmallMeta>
            🌡 Temperature · Avg {avg} · {count} vote{count === 1 ? "" : "s"}
          </SmallMeta>
        </div>
  
        {/* Render slider UI without its own frame */}
        <TempVoteView poll={poll} onVote={onVote} framed={false} />
      </div>
    );
  }
  