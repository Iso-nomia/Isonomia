// app/api/works/[id]/integrity/route.ts  (replace file with this version)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

type ChecklistItem = { key: string; label: string; ok: boolean; details?: string };
type IntegrityPayload = {
  ok: true;
  type: 'DN'|'IH'|'TC'|'OP';
  completion: number;               // 0..1 (all checklist rows)
  checklist: ChecklistItem[];
  has: {
    std: boolean; herm: boolean; prac: boolean; pascal: boolean;
    dn: boolean; ih: boolean; tc: boolean; op: boolean;
  };
  // NEW
  structureOk: boolean;   // theory-type structural slots complete
  adequacyOk: boolean;    // IH/TC: MCDA present, OP: Pascal decision present, DN: n/a
  valid: boolean;         // structureOk && adequacyOk (for IH/TC/OP); DN: structureOk
};

export async function GET(_req: NextRequest, { params }: { params: { id: string }}) {
  const w = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: {
      theoryType: true,
      standardOutput: true,
      hermeneuticProject:        { select: { id: true } },
      practicalJustification:    { select: { id: true, result: true } },
      pascalModel:               { select: { id: true, decision: true } },
      dnStructure: { select: { explanandum: true, nomological: true, ceterisParibus: true } },
      ihTheses:    { select: { structure: true, function: true, objectivity: true } },
      tcTheses:    { select: { instrumentFunction: true, explanation: true, applications: true } },
      opTheses:    { select: { unrecognizability: true, alternatives: true } },
    },
  });

  if (!w) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const type = w.theoryType as 'DN'|'IH'|'TC'|'OP';
  const hasStd    = !!w.standardOutput;
  const hasHerm   = !!w.hermeneuticProject;
  const hasPrac   = !!w.practicalJustification && !!w.practicalJustification.result && Object.keys(w.practicalJustification.result as any).length > 0;
  const hasPascal = !!w.pascalModel && !!w.pascalModel.decision && Object.keys(w.pascalModel.decision as any).length > 0;

  const hasDN = !!w.dnStructure && (!!w.dnStructure.explanandum || !!w.dnStructure.nomological);
  const hasIH = !!w.ihTheses && (!!w.ihTheses.structure || !!w.ihTheses.function || !!w.ihTheses.objectivity);
  const hasTC = !!w.tcTheses && (!!w.tcTheses.instrumentFunction || !!w.tcTheses.explanation || (w.tcTheses.applications ?? []).length > 0);
  const hasOP = !!w.opTheses && (!!w.opTheses.unrecognizability || (w.opTheses.alternatives ?? []).length > 0);

  const checklist: ChecklistItem[] = [];
  const add = (key: string, label: string, ok: boolean, details?: string) => checklist.push({ key, label, ok, details });

  if (type === 'DN') {
    add('TDN-Structure',   'Explanandum / nomological laws present', hasDN);
    add('TDN-Optionality', 'Ceteris paribus (optional)', !!w.dnStructure?.ceterisParibus);
  }
  if (type === 'IH') {
    add('TIH-Structure',   'Structure present', !!w.ihTheses?.structure);
    add('TIH-Function',    'Function present', !!w.ihTheses?.function);
    add('TIH-Objectivity', 'Objectivity justification', !!w.ihTheses?.objectivity);
    add('TIH-StdOutput',   'Standard output provided', hasStd);
    add('IH-Hermeneutic',  'Hermeneutic material saved', hasHerm);
    add('IH-Practical',    'Practical justification (MCDA) saved', hasPrac);
  }
  if (type === 'TC') {
    add('TTC-StdOutput',   'Standard output provided', hasStd);
    add('TTC-Function',    'Instrument function provided', !!w.tcTheses?.instrumentFunction);
    add('TTC-Explanation', 'Explanation of functioning', !!w.tcTheses?.explanation);
    add('TTC-Applications','Applications listed', (w.tcTheses?.applications ?? []).length > 0);
    add('TTC-Practical',   'Practical justification (MCDA) saved', hasPrac);
  }
  if (type === 'OP') {
    add('TOP-Unrecog',     'Unrecognizability argument', !!w.opTheses?.unrecognizability);
    add('TOP-Alternatives','Suitable alternatives listed', (w.opTheses?.alternatives ?? []).length > 1);
    add('TOP-Decision',    'Pascal decision saved', hasPascal);
  }

  const completion = checklist.length ? checklist.filter(i => i.ok).length / checklist.length : 0;

  // Structure-only notion by theory:
  const structureOk =
    type === 'DN' ? hasDN :
    type === 'IH' ? !!w.ihTheses?.structure && !!w.ihTheses?.function && !!w.ihTheses?.objectivity && hasStd :
    type === 'TC' ? !!w.tcTheses?.instrumentFunction && !!w.tcTheses?.explanation :
    type === 'OP' ? !!w.opTheses?.unrecognizability && (w.opTheses?.alternatives ?? []).length > 0 :
    false;

  const adequacyOk =
    type === 'IH' ? hasPrac :
    type === 'TC' ? hasPrac :
    type === 'OP' ? hasPascal :
    true; // DN: n/a

  const payload: IntegrityPayload = {
    ok: true,
    type,
    completion,
    checklist,
    has: { std: hasStd, herm: hasHerm, prac: hasPrac, pascal: hasPascal, dn: hasDN, ih: hasIH, tc: hasTC, op: hasOP },
    structureOk,
    adequacyOk,
    valid: structureOk && adequacyOk,
  };

  return NextResponse.json(payload);
}
