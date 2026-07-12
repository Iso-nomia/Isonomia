import { StateMachine, StateNode } from "@/lib/stateMachine";

test("state machine executes in order", async () => {
  const events: string[] = [];
  const nodes: StateNode<string>[] = [
    {
      id: "a",
      next: "b",
      run: async (input) => {
        events.push("a");
        return input + "a";
      },
    },
    {
      id: "b",
      run: async (input) => {
        events.push("b");
        return input + "b";
      },
    },
  ];

  const machine = new StateMachine(nodes, "a");
  const result = await machine.execute("");

  expect(result).toBe("ab");
  expect(events).toEqual(["a", "b"]);
});
