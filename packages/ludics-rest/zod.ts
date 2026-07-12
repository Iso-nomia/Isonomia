import { z } from 'zod';



export const zStep = z.object({
  dialogueId: z.string(),
  posDesignId: z.string(),
  negDesignId: z.string(),
  startPosActId: z.string().optional(),
  maxPairs: z.number().int().min(1).max(256).optional(),
});
export const zStepExtended = z.object({
  dialogueId: z.string().min(10),
  posDesignId: z.string().min(10),
  negDesignId: z.string().min(10),
  startPosActId: z.string().optional(),
  phase: z.enum(['focus-P','focus-O','neutral']).optional(),
  fuel: z.number().int().min(1).max(10000).optional().default(2048),
  compositionMode: z.enum(['assoc','partial','spiritual']).optional().default('assoc'),
  testers: z.array(
    z.union([
      z.object({ kind: z.literal('herd-to'), parentPath: z.string(), child: z.string() }),
      z.object({ kind: z.literal('timeout-draw'), atPath: z.string() }),
    ])
  ).optional(),
});


export const zConcession = z.object({
  dialogueId: z.string(),
  concedingParticipantId: z.string(),
  receiverParticipantId: z.string(),
  anchorDesignId: z.string(),
  proposition: z.object({ text: z.string(), csLocus: z.string() }),
  anchorLocus: z.string(),
});

export const zFax = z.object({ fromLocusPath: z.string(), toLocusPath: z.string() });

export const zApplyCS = z.object({
  ownerId: z.string(),
  add: z.array(z.object({
    label: z.string().optional(),
    basePolarity: z.enum(['pos','neg']),
    baseLocus: z.string(),
  })).optional(),
  erase: z.array(z.object({ byLabel: z.string().optional(), byLocus: z.string().optional() })).optional(),
});


export const zJudgeForce = z.object({
    dialogueId: z.string(),
    action: z.enum(['FORCE_CONCESSION', 'ASSIGN_BURDEN', 'CLOSE_BRANCH']),
    target: z.object({
      designId: z.string().optional(),
      participantId: z.string().optional(),
      locusPath: z.string().optional(),
    }).optional(),
    data: z.object({ text: z.string().optional() }).optional(),
  });
  
  export const zAppendActs = z.object({
    designId: z.string(),
    enforceAlternation: z.boolean().optional(),
    acts: z.array(z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('PROPER'),
        polarity: z.enum(['P','O']),
        locusPath: z.string(),
        ramification: z.array(z.string()),
        expression: z.string().optional(),
        meta: z.record(z.any()).optional(),
        additive: z.boolean().optional(),
      }),
      z.object({ kind: z.literal('DAIMON'), expression: z.string().optional() }),
    ])),
  });
  
  export const zOrthogonal = z.object({
    dialogueId: z.string(),
    posDesignId: z.string(),
    negDesignId: z.string(),
  });


export const zCommitmentsApply = z.object({
    dialogueId: z.string(),
    ownerId: z.string(),
    ops: z.object({
      add: z.array(z.object({
        label: z.string().min(1),
        basePolarity: z.enum(['pos','neg']),
        baseLocusPath: z.string().optional(),
        designIds: z.array(z.string()).optional(),
        derived: z.boolean().optional(),
      })).optional(),
      erase: z.array(z.object({
        byLabel: z.string().optional(),
        byLocusPath: z.string().optional(),
      })).optional(),
    }),
    autoPersistDerived: z.boolean().optional(),
  });