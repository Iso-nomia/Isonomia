// RingState represents one concentric ring
export interface RingState {
    letters: readonly string[];
    len: number;               // cache letters.length
    offset: number;            // 0 … len-1   (rotational state)
  }
  
  export interface ColumnState {
    pattern: [string, string, string, string];
    locked: boolean;
    heat: number;              // #words still possible
  }
  
  export interface GameMeta {
    puzzleId: string;
    par: number;
    spinsLimit: number;
  }
  
  export interface GameState {
    mode: 'classic' | 'time' | 'blindfold';
    rings: RingState[];        // always length 4
    columns: ColumnState[];    // always length 9  (max ring size)
    spins: number;
    solved: boolean;
  }