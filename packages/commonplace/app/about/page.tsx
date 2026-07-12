import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Commonplace",
  description:
    "Infrastructure for personal memory: a tool for solitary, slow, formative writing across years.",
};

export default function AboutPage() {
  return (
    <article className="space-y-5">
      <header className="space-y-3">
        <p className="font-sans text-xs uppercase tracking-wide text-stone-500">
          About
        </p>
        <h1 className="font-serif text-2xl text-stone-900">
          A Digital Commonplace Book
        </h1>
        <p className="font-serif text-base leading-relaxed text-stone-700">
          This is a tool for solitary, slow, formative writing whose principal
          output is the formation of the writer over years. Its value is in the practice it enables.
        </p>
      </header>

      <section className="space-y-4 border-t border-stone-500 pt-6">
        <h2 className="font-sans text-xs uppercase tracking-wide text-stone-700">
          What it is
        </h2>
        <p className="font-serif text-base leading-relaxed text-stone-700">
          A digital commonplace book. The tradition is old — Marcus Aurelius
          writing for himself, the medieval monastic notebook, Renaissance
          humanist commonplacing, Pascal&rsquo;s scattered fragments,
          Lichtenberg, Emerson, Nietzsche, Kafka, Pessoa, Sontag. What these
          practices share, across their differences, is a set of commitments
          that the contemporary note-taking ecosystem does not take seriously:
          that the archive is a site of sustained practice rather than a
          database, that revision is the work rather than a backup mechanism,
          and that the writer&rsquo;s relation to her own past is part of the
          work&rsquo;s substance.
        </p>
      </section>

      <section className="space-y-4 border-t border-stone-200 pt-6">
        <h2 className="font-sans text-xs uppercase tracking-wide text-stone-700">
          Why it exists
        </h2>
        <p className="font-serif text-base leading-relaxed text-stone-700">
          Durable personal memory is degrading under contemporary conditions of
          attention fragmentation, image oversupply, and the specific decline
          of the note-keeping and diary traditions that allowed prior
          generations to maintain coherent relations to their own pasts. The
          existing tools — Notion, Obsidian, the Roam-adjacent ecosystem —
          address the surface of this problem but operate within productivity
          assumptions that hollow out the tradition they claim to extend. The
          archive becomes a service to the self&rsquo;s efficiency rather than
          a site of the self&rsquo;s formation.
        </p>
        <p className="font-serif text-base leading-relaxed text-stone-700">
          Commonplace refuses that register. There are no streaks. There are
          no word counts. There is no &ldquo;saved!&rdquo; toast in green. You
          wrote; the URL changed; that is what happened.
        </p>
      </section>

      <section className="space-y-4 border-t border-stone-200 pt-6">
        <h2 className="font-sans text-xs uppercase tracking-wide text-stone-700">
          Architectural commitments
        </h2>
        <dl className="space-y-5 font-serif text-base leading-relaxed text-stone-700">
          <div className="space-y-1">
            <dt className="font-semibold text-stone-900">
              Temporal depth is primary.
            </dt>
            <dd>
              The archive&rsquo;s structure is its development across time, not
              a current state with timestamps attached. Three horizons — week,
              six months, years — change the kind of attention you bring to
              your own past.
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="font-semibold text-stone-900">
              Genre is structural.
            </dt>
            <dd>
              Excerpt, observation, meditation, dialogue, letter, list,
              fragment. Each is a different formal object with different
              affordances. They are not tags.
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="font-semibold text-stone-900">
              Revision is the work.
            </dt>
            <dd>
              Earlier selves are not overwritten by later selves. Both remain
              in the archive in conversation. A meditation developed across
              five years of revisions is itself the object.
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="font-semibold text-stone-900">
              The practice is solitary.
            </dt>
            <dd>
              No audience, no collaborator, no notification. Privacy is
              architectural. The archive is as private as a notebook in a
              drawer.
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 border-t border-stone-200 pt-6">
        <h2 className="font-sans text-xs uppercase tracking-wide text-stone-700">
          The vocabulary
        </h2>
        <p className="font-serif text-base leading-relaxed text-stone-700">
          Threads gather entries on a returning theme. Their dormancy is
          described in seasonal terms — <em>active</em>, <em>warm</em>,{" "}
          <em>dormant</em>, <em>fallow</em> — not in industrial ones. A thread
          untouched for two years is fallow, not stale. The vocabulary is the
          stance.
        </p>
      </section>

      <footer className="space-y-2 border-t border-stone-200 pt-6 font-sans text-xs text-stone-500">
        
        <p>
          <Link href="/write" className="text-stone-700 hover:underline">
            Begin
          </Link>
          {" · "}
          <Link href="/read" className="text-stone-700 hover:underline">
            Read what is here
          </Link>
        </p>
      </footer>
    </article>
  );
}
