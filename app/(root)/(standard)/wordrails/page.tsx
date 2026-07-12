"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { puzzles, dictionary } from "./data";

const MAX_RAILS = 6;

interface Stats {
  plays: number;
  wins: number;
  streak: number;
}

function getTodayPuzzle() {
  const index = Math.floor(Date.now() / 86400000) % puzzles.length;
  return puzzles[index];
}

function isOneLetterDiff(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff === 1;
}

export default function Page() {
  const puzzle = getTodayPuzzle();
  const [rails, setRails] = useState<string[]>([puzzle.start]);
  const [current, setCurrent] = useState("");
  const [stats, setStats] = useState<Stats>(() => {
    if (typeof window === "undefined") return { plays: 0, wins: 0, streak: 0 };
    const raw = localStorage.getItem("wordrails-stats");
    return raw ? JSON.parse(raw) : { plays: 0, wins: 0, streak: 0 };
  });

  const addRail = () => {
    const prev = rails[rails.length - 1];
    if (rails.length >= MAX_RAILS) return;
    if (!isOneLetterDiff(current, prev)) return;
    if (!dictionary.has(current)) return;
    setRails([...rails, current]);
    setCurrent("");
  };

  const isComplete = rails[rails.length - 1] === puzzle.end;

  useEffect(() => {
    if (!isComplete) return;
    setStats((prev) => {
      const updated = {
        plays: prev.plays + 1,
        wins: prev.wins + 1,
        streak: prev.streak + 1,
      };
      localStorage.setItem("wordrails-stats", JSON.stringify(updated));
      return updated;
    });
  }, [isComplete]);

  const shareResult = () => {
    const index = puzzles.indexOf(puzzle) + 1;
    const text = `WordRails #${index} ${rails.length - 1}/${puzzle.par}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Word Rails</h1>
      <p className="text-sm">Wins: {stats.wins} • Streak: {stats.streak}</p>
      <p>
        Start: {puzzle.start.toUpperCase()} → End: {puzzle.end.toUpperCase()}
      </p>
      <ul className="space-y-1 font-mono">
        {rails.map((word, i) => (
          <li key={i}>{word}</li>
        ))}
      </ul>
      {!isComplete && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addRail();
          }}
          className="space-y-2"
        >
          <Input
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-48"
          />
          <Button type="submit">Submit</Button>
        </form>
      )}
      {isComplete && (
        <div className="space-y-2">
          <p className="font-semibold">
            Puzzle complete in {rails.length - 1} rails!
          </p>
          <Button onClick={shareResult}>Share Result</Button>
        </div>
      )}
    </main>
  );
}
