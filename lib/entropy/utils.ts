export type TileInfo = { digit: number; status: "G" | "Y" | "X" };
export type SetSizes = { G: number; Y: number; X: number };

export function entropyDigits(secret: string, guess: string): {
  tiles: TileInfo[];
  setSizes: SetSizes;
} {
  const status: ("G" | "Y" | "X")[] = Array(6).fill("X");
  const secretRem = secret.split("");
  for (let i = 0; i < 6; i++) {
    if (guess[i] === secret[i]) {
      status[i] = "G";
      secretRem[i] = "_";
    }
  }
  for (let i = 0; i < 6; i++) {
    if (status[i] === "X") {
      const idx = secretRem.indexOf(guess[i]);
      if (idx !== -1) {
        status[i] = "Y";
        secretRem[idx] = "_";
      }
    }
  }
  const Gre = new Set<string>();
  const Yel = new Set<string>();
  const Gry = new Set<string>();
  status.forEach((st, i) => {
    const c = guess[i];
    if (st === "G") Gre.add(c);
    else if (st === "Y") Yel.add(c);
    else Gry.add(c);
  });
  const sizes = { G: Gre.size, Y: Yel.size, X: Gry.size };
  const tiles = status.map<TileInfo>(st => ({
    status: st,
    digit: st === "G" ? sizes.G : st === "Y" ? sizes.Y : sizes.X,
  }));
  return { tiles, setSizes: sizes };
}
