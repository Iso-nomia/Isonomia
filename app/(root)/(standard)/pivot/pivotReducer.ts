import { produce, Draft } from 'immer';           // keeps code readable
import { GameState, RingState } from './types/pivot';

type InitPayload = { initialState: GameState };

export type Action =
  | { type: 'INIT_GAME'; payload: InitPayload }
  | { type: 'ROTATE'; ringIndex: 0|1|2|3; dir: 1|-1 }
  | { type: 'GIVE_UP' }
  | { type: 'PEEK_HINT'; column: number };

function handleRotate(draft: Draft<GameState>, ringIndex: 0|1|2|3, dir: 1|-1) {
  const ring = draft.rings[ringIndex];
  if (!ring) return;
  ring.offset = (ring.offset + dir + ring.len) % ring.len;
  draft.spins += 1;
}

function revealLetter(draft: Draft<GameState>, column: number) {
  const col = draft.columns[column];
  if (col) col.locked = true;
}

export function pivotReducer(state: GameState, action: Action): GameState {
  return produce(state, draft => {
    switch (action.type) {
      case 'INIT_GAME':
        return action.payload.initialState as unknown as typeof draft;

      case 'ROTATE':
        handleRotate(draft, action.ringIndex, action.dir);
        return;

      case 'PEEK_HINT':
        revealLetter(draft, action.column);
        return;

      /* …more… */
    }
  });
}
