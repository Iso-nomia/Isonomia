import { Swords, SearchX } from "lucide-react";
import type { ChallengeThreadVM } from "@/lib/citations/argumentDialectic";
import ChallengeThread from "./ChallengeThread";

/**
 * The threaded dialectical record: filed attacks (ConflictApplications) and
 * their responses. Placed after Premises / Evidence and before Pending CQs —
 * filed attacks are *actual, instantiated* challenges, so they sit above the
 * *latent, scheme-required* CQ obligations.
 *
 * Renders even when empty: an unopposed argument is **untested, not proven**,
 * and the empty-state copy says so.
 *
 * Server-safe (presentational).
 */
export default function ChallengesAndResponses({
  threads,
  deliberationUrl,
}: {
  threads: ChallengeThreadVM[];
  /** Base URL of the deliberation, used to build "Respond" deep links. */
  deliberationUrl?: string;
}) {
  const buildRespondHref = (t: ChallengeThreadVM): string | undefined => {
    if (!deliberationUrl) return undefined;
    const targetType = t.target.kind === "conclusion" ? "claim" : "argument";
    const params = new URLSearchParams({
      targetId: t.id,
      targetType,
      attackType: t.attackType,
    });
    return `${deliberationUrl}?${params.toString()}`;
  };

  return (
    <section className="rounded-2xl p-6 mb-6 panelv2">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/10 to-red-500/15 text-rose-600">
          <Swords className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-700">
          Challenges &amp; responses ({threads.length})
        </h3>
      </div>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-8">
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-400">
            <SearchX className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            No one has tested this argument yet.
          </p>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            An unopposed argument is <span className="italic">untested</span>,
            not proven. Filing a rebut, undercut, or undermine is how its
            standing gets earned.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Typed, anchored challenges filed against this argument on the graph,
            with the responses defending or conceding them. A{" "}
            <span className="font-semibold">Proposed</span> attack is filed and
            awaiting human sign-off — it has not yet defeated anything.
          </p>
          <div className="flex flex-col gap-3">
            {threads.map((thread) => (
              <ChallengeThread
                key={thread.id}
                thread={thread}
                respondHref={buildRespondHref(thread)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
