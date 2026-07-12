// kb/editor/plugins/SlashMenu.ts

export type SlashItem = {
  label: string;
  type: string;
  icon: string;
};

export const items: SlashItem[] = [
  { label:'/claim',     type:'claim',     icon:'◦' },
  { label:'/argument',  type:'argument',  icon:'⟂' },
  { label:'/sheet',     type:'sheet',     icon:'▣' },
  { label:'/transport', type:'transport', icon:'⇄' },
  { label:'/evidence',  type:'evidence_list', icon:'⌖' },
  { label:'/cq',        type:'cq_tracker', icon:'?' },
];

type SlashHandler = (pick: SlashItem) => void;
type OnSlash = (handler: SlashHandler) => void;
type CreateBlock = (input: { type: string; dataJson: Record<string, unknown> }) => Promise<unknown>;
type InsertDecoratorNode = (block: unknown) => void;

/**
 * Wire the slash menu into the editor. The host editor supplies the
 * `onSlash` subscription plus the `createBlock` / `insertDecoratorNode`
 * primitives; this module only owns the menu item set and the wiring.
 */
export function registerSlashMenu(deps: {
  onSlash: OnSlash;
  createBlock: CreateBlock;
  insertDecoratorNode: InsertDecoratorNode;
}) {
  const { onSlash, createBlock, insertDecoratorNode } = deps;
  onSlash((pick) => {
    // persist a new KbBlock row, then replace current Lexical paragraph with a stub “embed”
    createBlock({ type: pick.type, dataJson: {} }).then(insertDecoratorNode);
  });
}
