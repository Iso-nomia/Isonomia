export interface StateNode<T = any> {
  id: string;
  run: (input: T) => Promise<T> | T;
  next?: string;
}

export class StateMachine<T = any> {
  private nodes: Record<string, StateNode<T>>;
  private start: string;

  constructor(nodes: StateNode<T>[], start: string) {
    this.nodes = Object.fromEntries(nodes.map((n) => [n.id, n]));
    this.start = start;
  }

  async execute(input: T): Promise<T> {
    let current = this.start;
    let output = input;
    while (current) {
      const node = this.nodes[current];
      if (!node) {
        throw new Error(`Node ${current} not found`);
      }
      output = await node.run(output);
      current = node.next ?? "";
    }
    return output;
  }
}
