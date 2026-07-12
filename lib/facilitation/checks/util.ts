/**
 * Facilitation — Pure text utilities for question checks.
 *
 * Deterministic, stateless. v1 is English-tuned.
 */

const SENTENCE_END = /([.!?]+)(?=\s|$)/g;
const TOKEN_SPLIT = /[\s\u00A0]+/;

export function tokens(text: string): string[] {
  return text
    .split(TOKEN_SPLIT)
    .map((t) => t.replace(/^[^a-zA-Z0-9'’\-]+|[^a-zA-Z0-9'’\-]+$/g, ""))
    .filter((t) => t.length > 0);
}

export function sentenceCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(SENTENCE_END);
  if (!matches) return 1;
  // If text ends with a terminator the count == matches; otherwise the
  // trailing fragment is one more sentence.
  const endsWithTerminator = /[.!?]\s*$/.test(trimmed);
  return matches.length + (endsWithTerminator ? 0 : 1);
}

export function questionMarkCount(text: string): number {
  return (text.match(/\?/g) || []).length;
}

export function avgWordLength(toks: string[]): number {
  if (toks.length === 0) return 0;
  const total = toks.reduce((s, t) => s + t.length, 0);
  return total / toks.length;
}

/**
 * Syllable count heuristic — vowel-group based with common silent-e and
 * trailing-le adjustments. Sufficient for Flesch-Kincaid; not linguistic-grade.
 */
export function syllables(word: string): number {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  let stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, "");
  stripped = stripped.replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function totalSyllables(toks: string[]): number {
  return toks.reduce((s, t) => s + syllables(t), 0);
}

/**
 * Flesch-Kincaid grade level.
 * 0.39 * (words / sentences) + 11.8 * (syllables / words) − 15.59
 */
export function fleschKincaidGrade(text: string): {
  grade: number;
  ease: number;
  syllableCount: number;
  wordCount: number;
  sentenceCount: number;
} {
  const toks = tokens(text);
  const sCount = Math.max(1, sentenceCount(text));
  const wCount = Math.max(1, toks.length);
  const syl = totalSyllables(toks);
  const grade = 0.39 * (wCount / sCount) + 11.8 * (syl / wCount) - 15.59;
  const ease = 206.835 - 1.015 * (wCount / sCount) - 84.6 * (syl / wCount);
  return {
    grade: Math.round(grade * 10) / 10,
    ease: Math.round(ease * 10) / 10,
    syllableCount: syl,
    wordCount: toks.length,
    sentenceCount: sentenceCount(text),
  };
}

export function lowerSet(words: string[]): Set<string> {
  return new Set(words.map((w) => w.toLowerCase()));
}
