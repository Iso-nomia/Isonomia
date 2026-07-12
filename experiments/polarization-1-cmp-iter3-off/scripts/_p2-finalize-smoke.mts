import type { Phase2PartialFile } from "../orchestrator/phases/phase-2-arguments";
const r = await import("../orchestrator/review/phase-2-report");
const renderReportMarkdownPhase2 = r.renderReportMarkdownPhase2;
const parseMod = await import("../orchestrator/review/report");
const parseReport = parseMod.parseReport;

const partial: Phase2PartialFile = {
  phase: 2, status: "partial", generatedAt: new Date().toISOString(),
  deliberationId: "delib-test", modelTier: "dev",
  topologyBinding: { count: 9, layerByIndex: { 1:"definitional",2:"empirical",3:"causal",4:"causal",5:"empirical",6:"empirical",7:"causal",8:"causal",9:"normative" }, hingeIndices: [2,3,4] },
  evidenceStackId: "stack-test",
  advocates: {
    a: { role: "advocate-a", outcome: "ok", attempts: 1, tokenUsage: { inputTokens: 5000, outputTokens: 4500 }, mintResult: { arguments: [], totals: { argumentsCreated: 14, premiseClaimsMinted: 32, premiseClaimsDeduped: 4, citationsAttached: 28 } }, artifacts: { promptPath: "x", roundLogPath: "y" } } as any,
    b: undefined,
  },
  totals: { argumentsCreated: 14, premiseClaimsMinted: 32, premiseClaimsDeduped: 4, citationsAttached: 28, inputTokens: 5000, outputTokens: 4500 },
  reviewFlags: [
    { ruleId: "hinge_concentration", severity: "warn", message: "Advocate A: hinge sub-claim #4 has 2 argument(s); recommended >= 4.", evidence: { advocate: "a", subClaim: 4, count: 2 } },
    { ruleId: "padding", severity: "warn", message: "Advocate A: source src:7 backs 4/6 cited premises (67%) on sub-claim #2.", evidence: { advocate: "a" } },
  ],
  artifacts: { partialPath: "PHASE_2_PARTIAL.json" },
};

const md = renderReportMarkdownPhase2(partial);
console.log(md.split("\n").slice(0, 30).join("\n"));
console.log("---");
console.log(`total length: ${md.length} chars; flag headers: ${(md.match(/^## Flag /gm) || []).length}`);
const filled = md.replace(/\*\*Verdict:\*\* \[ \] accept  \[ \] revise  \[ \] retract  Notes:/g, "**Verdict:** [x] accept  [ ] revise  [ ] retract  Notes: looks fine");
const verdicts: any[] = parseReport(filled);
console.log(`parser round-trip: ${verdicts.length} verdict(s)`, verdicts.map((v) => `${v.flagIndex}:${v.ruleId}=${v.verdict}`).join(", "));

const idx = await import("../orchestrator/index");
console.log("CLI module loads OK");
