import {
  classifyGoalPremise,
  type GoalTypeClassification,
} from "@/lib/schemes/practical-goal-type";

describe("classifyGoalPremise", () => {
  test("instrumental goal language routes to practical_reasoning", () => {
    const r = classifyGoalPremise(
      "We should raise the carbon price in order to achieve our emissions goal."
    );
    expect(r.kind).toBe("instrumental");
    expect(r.preferredScheme).toBe("practical_reasoning");
    expect(r.signals.instrumental.length).toBeGreaterThan(0);
  });

  test("value language routes to value_based_pr", () => {
    const r = classifyGoalPremise(
      "We should adopt this policy because it promotes fairness and respects the dignity of workers."
    );
    expect(r.kind).toBe("value-based");
    expect(r.preferredScheme).toBe("value_based_pr");
    expect(r.signals.valueBased.length).toBeGreaterThan(0);
  });

  test("no signal ⇒ ambiguous, no forced route", () => {
    const r = classifyGoalPremise("We should do this.");
    expect(r.kind).toBe("ambiguous");
    expect(r.preferredScheme).toBeNull();
    expect(r.confidence).toBe(0);
  });

  test("a tie is ambiguous (no forced route)", () => {
    // one instrumental cue ("to achieve") + one value cue ("fairness")
    const r = classifyGoalPremise("We must act to achieve fairness.");
    expect(r.signals.instrumental.length).toBe(r.signals.valueBased.length);
    expect(r.kind).toBe("ambiguous");
    expect(r.preferredScheme).toBeNull();
  });

  test("confidence is the normalized dominance margin", () => {
    const r = classifyGoalPremise(
      "This is the best way to achieve the goal efficiently."
    );
    // all instrumental, no value cues ⇒ confidence 1
    expect(r.signals.valueBased).toEqual([]);
    expect(r.confidence).toBe(1);
  });

  test("pure: same input ⇒ same output", () => {
    const text = "We should uphold justice in order to achieve equity.";
    const a: GoalTypeClassification = classifyGoalPremise(text);
    const b: GoalTypeClassification = classifyGoalPremise(text);
    expect(a).toEqual(b);
  });
});
