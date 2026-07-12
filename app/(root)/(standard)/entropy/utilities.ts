// Shape encoding for the three hidden colours
export const SHAPE: Record<"G" | "Y" | "X", string> = {
    G: "◯",   // circle   (green)
    Y: "□",   // square   (yellow)
    X: "△",   // triangle (grey)
  };
  
  // Render e.g. 2◯   1□   3△
  export function decorate(
    digit: number,
    status: "G" | "Y" | "X"
  ): string {
    /*  STANDARD SHAPE DECORATION  */
    return `${digit}${SHAPE[status]}`;
  
    /*  ALT: numeric-band version – uncomment to use
    const base = status === "G" ? 10 : status === "Y" ? 20 : 30;
    return String(base + digit);
    */
  }
  
  // helper that returns a word with six distinct letters
  export function pickStarter(dictionary: string[]): string {
    const uniques = dictionary.filter(
      w => new Set(w).size === 6 && w.length === 6
    );
    return uniques[Math.floor(Math.random() * uniques.length)];
  }
  