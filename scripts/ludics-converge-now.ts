
import { prisma } from '@/lib/prisma-cli';
import { appendActs } from '@/packages/ludics-engine/appendActs';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

const deliberationId = process.argv[2] || 'dlg1';


(async () => {
    const designs = await prisma.ludicDesign.findMany({
      where: { deliberationId },
      orderBy: { participantId: 'asc' },
    });
    if (designs.length < 2) { console.log('compile first'); return; }
  
    const [A, B] = designs;
    await appendActs(B.id, [{ kind: 'DAIMON' }]);
    const res = await stepInteraction({ dialogueId: deliberationId, posDesignId: A.id, negDesignId: B.id });
    console.log(res);
  })();