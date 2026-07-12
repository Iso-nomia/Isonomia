import { prisma } from '@/lib/prismaclient';
import { emitBus } from '@/lib/server/bus';
export type LudicDecisionReceiptInput = {
  deliberationId: string;
  kind: 'epistemic'|'procedural'|'allocative'|'editorial';
  subject: { type: 'claim'|'locus'|'view'|'option'|'card'; id: string };
  issuedBy: { who: 'system'|'panel'|'vote'; byId?: string };
  rationale?: string;
  inputs: Record<string, any>;
  version?: number;
};

export async function createDecisionReceipt(input: LudicDecisionReceiptInput) {
  const receipt = await prisma.ludicDecisionReceipt.create({
    data: {
      deliberationId: input.deliberationId,
      kind: input.kind,
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      issuedBy: input.issuedBy.who === 'panel' ? `panel:${input.issuedBy.byId ?? ''}` : input.issuedBy.who,
      rationale: input.rationale ?? null,
      inputsJson: input.inputs,
      version: input.version ?? 1,
    },
  });

  emitBus('decision:changed', {
    deliberationId: input.deliberationId,
    subjectType: input.subject.type,
    subjectId: input.subject.id,
    receiptId: receipt.id,
  });

  return receipt;
}
