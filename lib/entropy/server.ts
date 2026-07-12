import { dictionaryArray } from "@/app/(root)/(standard)/entropy/data";

export function pickRandomSecret(): string {
  const idx = Math.floor(Math.random() * dictionaryArray.length);
  return dictionaryArray[idx];
}
