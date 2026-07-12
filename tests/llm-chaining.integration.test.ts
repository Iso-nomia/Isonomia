import { StateMachine, StateNode } from "@/lib/stateMachine";

type Context = string;

function llmNode(id: string, append: string, next?: string): StateNode<Context> {
  return {
    id,
    next,
    run: async (input: Context) => input + append,
  };
}

test("LLM instruction nodes chain outputs", async () => {
  const machine = new StateMachine<Context>([
    llmNode("one", "A", "two"),
    llmNode("two", "B", "three"),
    llmNode("three", "C"),
  ], "one");

  const result = await machine.execute("");
  expect(result).toBe("ABC");
});
