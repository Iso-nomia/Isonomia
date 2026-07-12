import Link from "next/link";
import { Swords, Scissors, Pickaxe } from "lucide-react";
import type { AttackType } from "@/lib/citations/argumentDialectic";

/**
 * Inline anchor marker rendered on the targeted node (conclusion / inference /
 * premise). It preserves *what is under attack* — flattening attacks into one
 * list would destroy that — and smooth-scrolls to the matching thread in the
 * Challenges & Responses section.
 *
 * Server-safe: uses a native in-page `#anchor` link.
 */

const ICON: Record<AttackType, typeof Swords> = {
  REBUT: Swords,
  UNDERCUT: Scissors,
  UNDERMINE: Pickaxe,
};

const LABEL: Record<AttackType, string> = {
  REBUT: "rebutted",
  UNDERCUT: "undercut",
  UNDERMINE: "undermined",
};

export default function ChallengeAnchorChip({
  attackType,
  threadId,
  count = 1,
}: {
  attackType: AttackType;
  /** `ConflictApplication.id` of the thread to scroll to. */
  threadId: string;
  /** Number of attacks of this type on the node (for the "×N" affix). */
  count?: number;
}) {
  const Icon = ICON[attackType];
  return (
    <Link
      href={`#challenge-${threadId}`}
      scroll
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.06em] uppercase bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
      aria-label={`This is ${LABEL[attackType]} — jump to the challenge`}
    >
      <Icon className="w-3 h-3" />
      {LABEL[attackType]}
      {count > 1 && <span className="text-rose-500">×{count}</span>}
    </Link>
  );
}
