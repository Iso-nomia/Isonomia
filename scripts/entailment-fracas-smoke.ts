// scripts/entailment-fracas-smoke.ts
// Usage: npx ts-node -P tsconfig.scripts.json -r tsconfig-paths/register scripts/entailment-fracas-smoke.ts
import { entailDialogical } from '@/packages/entail/dialogical';

const cases = [
  {
    name: 'MP',
    T: ['If a then b', 'a'],
    H: 'b',
    expect: 'ENTAILED',
  },
  {
    name: 'AND-ELIM',
    T: ['p and q'],
    H: 'p',
    expect: 'ENTAILED',
  },
  {
    name: 'Barbara-like (All)',
    T: ['All men are mortal', 'socrates is a man'],
    H: 'socrates is mortal',
    expect: 'ENTAILED',
  },
  {
    name: 'Unknown',
    T: ['If a then b'],
    H: 'b',
    expect: 'UNDECIDED',
  },
  {
    name: 'Conflict',
    T: ['no cats are dogs', 'felix is a cat', 'felix is a dog'],
    H: 'felix is a dog',
    expect: 'CONTRADICTS',
  },
];

let pass = 0;
for (const c of cases) {
  const r = entailDialogical({ textSentences: c.T, hypothesis: c.H });
  const ok = r.status === c.expect as any;
  if (ok) pass++; else {
    console.error(`[FAIL] ${c.name}: got ${r.status}, expected ${c.expect}`);
  }
}
console.log(`[fracas-smoke] ${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
