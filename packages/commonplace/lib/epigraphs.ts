/**
 * Epigraphs.
 *
 * Pre-seeded fragments from the commonplace tradition itself, used as a
 * very quiet prompt on the empty /write page. The design language doc
 * anticipates this in §10: "specific invitations into the practice —
 * perhaps in the form of excerpts from the tradition itself."
 *
 * Rendering rules (see WritePage):
 *   - Visible only while the editor is empty.
 *   - Italic serif, text-stone-400. Never bolded, never accented.
 *   - One epigraph per page-load, chosen pseudo-randomly.
 *   - Disappears on first keystroke. Does not return.
 *
 * To add an epigraph: append to the array. Keep them short (one or two
 * sentences). Attribution is bare — name only, no dates, no titles.
 * The point is the fragment, not the citation.
 */

export type Epigraph = {
  text: string;
  author: string;
};

export const EPIGRAPHS: Epigraph[] = [
  {
    text: "I quote others only in order the better to express myself.",
    author: "Montaigne",
  },
  {
    text: "Write down the thoughts of the moment. Those that come unsought for are commonly the most valuable.",
    author: "Bacon",
  },

  {
    text: "Think with the deep mind of the body.",
    author: "Pascal",
  },
  {
    text: "Begin at once to live, and count each separate day as a separate life.",
    author: "Seneca",
  },
  {
    text: "It is not what we read, but what we remember, that makes us learned.",
    author: "Bacon",
  },
  {
    text: "Look within. Within is the fountain of good, and it will ever bubble up, if thou wilt ever dig.",
    author: "Marcus Aurelius",
  },
  {
    text: "The unexamined life is not worth living.",
    author: "Socrates",
  },
  {
    text: "What we observe is not nature itself, but nature exposed to our method of questioning.",
    author: "Heisenberg",
  },
  {
    text: "Attention is the rarest and purest form of generosity.",
    author: "Weil",
  },
  {
    text: "He who has a why to live for can bear almost any how.",
    author: "Nietzsche",
  },
  {
    text: "A thought is an arrow shot at the truth; it can hit a point, but cannot cover the whole target.",
    author: "Tagore",
  },
  {
    text: "We do not learn from experience. We learn from reflecting on experience.",
    author: "Dewey",
  },
  {
    text: "What can be said at all can be said clearly; and whereof one cannot speak, thereof one must be silent.",
    author: "Wittgenstein",
  },
  {
    text: "The notebook is the writer's other room.",
    author: "Didion",
  },
  {
    text: "Read in order to live.",
    author: "Flaubert",
  },
  {
    text: "Patience is the companion of wisdom.",
    author: "Augustine",
  },
  {
    text: "All philosophy is contained in a poet's notebook.",
    author: "Valéry",
  },
];

/**
 * Pick one. Deterministic per session if a seed is provided, otherwise
 * random. The /write page passes a date-derived seed so the same
 * epigraph holds for the duration of one writing session.
 */
export function pickEpigraph(seed?: number): Epigraph {
  if (seed === undefined) {
    return EPIGRAPHS[Math.floor(Math.random() * EPIGRAPHS.length)];
  }
  const idx = Math.abs(Math.floor(seed)) % EPIGRAPHS.length;
  return EPIGRAPHS[idx];
}
