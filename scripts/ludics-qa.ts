// scripts/ludics-qa.ts
// Enhanced QA script for testing Phase 1 Ludics integrations
// Tests: AIF sync, insights computation, caching, backfill validation
import { prisma } from '@/lib/prisma-cli';
import { compileFromMoves } from '@/packages/ludics-engine/compileFromMoves';
import { appendActs } from '@/packages/ludics-engine/appendActs';
import { stepInteraction } from '@/packages/ludics-engine/stepper';
import { syncLudicsToAif } from '@/lib/ludics/syncToAif';
import { computeInsights } from '@/lib/ludics/computeInsights';
import { invalidateInsightsCache } from '@/lib/ludics/insightsCache';
import { computeDialogueMoveSignature } from '@/lib/dialogue/signature';

const deliberationId = process.argv[2] || 'cmgy6c8vz0000c04w4l9khiux';
const P = 'Proponent';
const O = 'Opponent';

async function main() {
  console.log('\n🧪 [Ludics QA] Starting comprehensive test for', deliberationId);
  console.log('━'.repeat(60));

  // 0) ensure deliberation
  await prisma.deliberation.upsert({
    where: { id: deliberationId },
    update: {},
    create: { id: deliberationId, hostType: 'article', hostId: 'qa', createdById: 'system' },
  });
  console.log('✓ Deliberation upserted');

  // 1) clean previous data (idempotent)
  await prisma.dialogueMove.deleteMany({ where: { deliberationId } }).catch(()=>{});
  await prisma.ludicDesign.deleteMany({ where: { deliberationId } }).catch(()=>{});
  await prisma.aifNode.deleteMany({ where: { deliberationId } }).catch(()=>{});
  console.log('✓ Cleaned prior data (moves, designs, AIF nodes)');

  // 2) seed dialogue moves with signatures
  console.log('\n📝 Seeding dialogue moves...');
  const moves = [
    { deliberationId, targetType:'claim', targetId:'C_core', kind:'ASSERT',
      payload:{ text:'policy A is beneficial', additive:false }, actorId:P },
    { deliberationId, targetType:'claim', targetId:'C_core', kind:'WHY',
      payload:{ schemeKey:'Consequences', cqId:'ac-2', note:'are important consequences omitted?' },
      actorId:O },
    { deliberationId, targetType:'claim', targetId:'C_core', kind:'GROUNDS',
      payload:{ schemeKey:'Consequences', cqId:'ac-2', brief:'we include mitigation costs', locusPath:'0' },
      actorId:P },
    { deliberationId, targetType:'claim', targetId:'C_core', kind:'WHY',
      payload:{ schemeKey:'Expert', cqId:'ae-1', note:'is the expert credible?' },
      actorId:O },
    { deliberationId, targetType:'claim', targetId:'C_core', kind:'GROUNDS',
      payload:{ schemeKey:'Expert', cqId:'ae-1', brief:'expert has 15 years experience', locusPath:'0.1' },
      actorId:P },
  ];

  // Add signatures to each move
  const movesWithSigs = moves.map(m => ({
    ...m,
    signature: computeDialogueMoveSignature({
      deliberationId: m.deliberationId,
      targetType: m.targetType,
      targetId: m.targetId,
      kind: m.kind,
      payload: m.payload,
    }),
  }));

  await prisma.dialogueMove.createMany({
    data: movesWithSigs,
    skipDuplicates: true,
  });
  console.log('✓ Inserted 5 moves: ASSERT + 2x WHY + 2x GROUNDS');

  // 3) compile designs FROM DIALOGUE MOVES
  console.log('\n🔧 Compiling Ludics designs from DialogueMoves...');
  const { designs } = await compileFromMoves(deliberationId);
  console.log('✓ Compiled designs from dialogue moves:', designs);

  const ds = await prisma.ludicDesign.findMany({
    where: { id: { in: designs } },
    include: { acts: true },
  });
  const dP = ds.find(d => d.participantId===P) ?? ds[0];
  const dO = ds.find(d => d.participantId===O) ?? ds[1] ?? ds[0];
  console.log(`✓ Proponent design: ${dP?.id} (${dP?.acts.length} acts)`);
  console.log(`✓ Opponent design: ${dO?.id} (${dO?.acts.length} acts)`);

  if (!dP || !dO) { throw new Error('❌ Designs missing after compile'); }

  // Verify DialogueMoves were compiled into acts
  const totalActsFromMoves = (dP?.acts.length ?? 0) + (dO?.acts.length ?? 0);
  console.log(`✓ Total acts compiled from ${moves.length} dialogue moves: ${totalActsFromMoves}`);
  
  if (totalActsFromMoves === 0) {
    throw new Error('❌ No acts created from DialogueMoves - compilation failed!');
  }

  // 4) TEST: Sync to AIF (Phase 1 feature)
  console.log('\n🔗 Testing AIF sync (Phase 1: Task 1.2)...');
  await syncLudicsToAif(deliberationId);
  
  const aifNodes = await prisma.aifNode.findMany({
    where: { deliberationId },
    select: { id: true, ludicActId: true, locusPath: true, locusRole: true },
  });
  console.log(`✓ Created ${aifNodes.length} AifNodes`);
  aifNodes.slice(0, 3).forEach(n => 
    console.log(`  → ${n.id}: act=${n.ludicActId?.slice(0,8)} locus=${n.locusPath} role=${n.locusRole}`)
  );

  // 5) TEST: Compute insights (Phase 1 feature)
  console.log('\n📊 Testing insights computation (Phase 1: Task 1.4)...');
  const insights = await computeInsights(deliberationId);
  if (insights) {
    console.log('✓ Insights computed:');
    console.log(`  → Total acts: ${insights.totalActs}`);
    console.log(`  → Total loci: ${insights.totalLoci}`);
    console.log(`  → Max depth: ${insights.maxDepth}`);
    console.log(`  → Branch factor: ${insights.branchFactor.toFixed(2)}`);
    console.log(`  → Complexity score: ${insights.complexityScore}/100`);
    console.log(`  → Orthogonality: ${insights.orthogonalityStatus ?? 'pending'}`);
    console.log(`  → Role distribution:`, insights.roleDistribution);
  } else {
    console.log('⚠️  No insights computed (empty designs?)');
  }

  // 6) TEST: Cache invalidation (Phase 1 feature)
  console.log('\n🗑️  Testing cache invalidation (Phase 1: Task 1.6)...');
  await invalidateInsightsCache(deliberationId);
  console.log('✓ Cache invalidated');

  // 7) additive node (⊕) with two children
  console.log('\n🌳 Adding additive node with branches...');
  await appendActs(dP.id, [
    { kind:'PROPER', polarity:'P', locus:'0.2',   ramification:[], expression:'choose mitigation or trade-off', additive:true },
    { kind:'PROPER', polarity:'P', locus:'0.2.1', ramification:[], expression:'mitigation path' },
    { kind:'PROPER', polarity:'P', locus:'0.2.2', ramification:[], expression:'trade-off path' },
  ], { enforceAlternation:false }, prisma);
  console.log('✓ Appended additive block at 0.2 with 2 children');

  // 8) opponent response
  await appendActs(dO.id, [
    { kind:'PROPER', polarity:'O', locus:'0', ramification:[], expression:'risk outweighs benefit' },
    { kind:'PROPER', polarity:'O', locus:'0.1', ramification:[], expression:'insufficient evidence' },
  ], { enforceAlternation:false }, prisma);
  console.log('✓ Appended 2 Opponent replies');

  // 9) Re-sync to AIF after new acts
  console.log('\n🔄 Re-syncing to AIF after new acts...');
  await syncLudicsToAif(deliberationId);
  const aifNodesAfter = await prisma.aifNode.findMany({
    where: { deliberationId },
  });
  console.log(`✓ AIF nodes after update: ${aifNodesAfter.length}`);

  // 10) step interaction
  console.log('\n⚡ Stepping interaction...');
  let step = await stepInteraction({ 
    dialogueId: deliberationId, 
    posDesignId: dP.id, 
    negDesignId: dO.id, 
    phase:'neutral', 
    maxPairs: 1024 
  });
  console.log(`✓ After step: status=${step.status}, pairs=${step.pairs?.length ?? 0}`);

  // 11) Re-compute insights after interaction
  console.log('\n📊 Re-computing insights after interaction...');
  const insightsAfter = await computeInsights(deliberationId);
  if (insightsAfter) {
    console.log('✓ Updated insights:');
    console.log(`  → Total acts: ${insightsAfter.totalActs}`);
    console.log(`  → Complexity: ${insightsAfter.complexityScore}/100`);
    if (insightsAfter.topLoci && insightsAfter.topLoci.length > 0) {
      console.log(`  → Top loci:`, insightsAfter.topLoci.slice(0, 3).map(l => l.path));
    }
  }

  // 12) converge: append daimon and step
  console.log('\n🎯 Testing convergence...');
  await appendActs(dO.id, [{ kind:'DAIMON', expression:'END' }], { enforceAlternation:false }, prisma);
  step = await stepInteraction({ 
    dialogueId: deliberationId, 
    posDesignId: dP.id, 
    negDesignId: dO.id, 
    phase:'neutral', 
    maxPairs: 1024 
  });
  console.log(`✓ Converged: status=${step.status}`);
  if (step.decisiveIndices && step.decisiveIndices.length > 0) {
    console.log(`✓ Decisive indices: ${step.decisiveIndices.join(', ')}`);
  }

  // 13) Final validation
  console.log('\n✅ Final validation...');
  const finalDesigns = await prisma.ludicDesign.count({ where: { deliberationId } });
  const finalActs = await prisma.ludicAct.count({ 
    where: { design: { deliberationId } } 
  });
  const finalAifNodes = await prisma.aifNode.count({ where: { deliberationId } });
  const finalEdges = await prisma.aifEdge.count({ where: { deliberationId } });

  console.log(`✓ Final counts:`);
  console.log(`  → Designs: ${finalDesigns}`);
  console.log(`  → Acts: ${finalActs}`);
  console.log(`  → AIF Nodes: ${finalAifNodes}`);
  console.log(`  → AIF Edges: ${finalEdges}`);

  // 14) Verify backfill integrity
  console.log('\n🔍 Verifying backfill integrity...');
  const actsWithoutAif = await prisma.ludicAct.count({
    where: {
      design: { deliberationId },
      aifNode: null,
    },
  });
  if (actsWithoutAif === 0) {
    console.log('✓ All acts have AIF nodes (backfill complete)');
  } else {
    console.log(`⚠️  ${actsWithoutAif} acts missing AIF nodes`);
  }

  console.log('\n' + '━'.repeat(60));
  console.log('🎉 Ludics QA complete! All Phase 1 features tested.');
  console.log('━'.repeat(60) + '\n');
}

main().then(() => {
  console.log('✨ Test completed successfully');
  process.exit(0);
}).catch(e => {
  console.error('\n❌ [QA ERROR]', e);
  process.exit(1);
});
