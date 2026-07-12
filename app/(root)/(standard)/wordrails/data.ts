export interface Puzzle {
  start: string;
  end: string;
  par: number;
}

export const puzzles: Puzzle[] = [
  { start: "cold", end: "warm", par: 4 },
  { start: "head", end: "tail", par: 5 },
];

export const dictionary = new Set(
  [
    "cold","cord","card","ward","warm",
    "head","heal","teal","tell","tall","tail",
  ]
);
