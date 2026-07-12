#!/usr/bin/env tsx
/**
 * Test script for contradiction detection
 * 
 * Usage: 
 *   npx tsx scripts/test-contradictions.ts
 * 
 * This script:
 * 1. Fetches all commitments for the "ludics-forest-demo" deliberation
 * 2. Groups commitments by participant
 * 3. Runs contradiction detection on each participant's commitments
 * 4. Reports detailed analysis including:
 *    - Active vs inactive commitments
 *    - Positive vs negative claims
 *    - Any contradictions found with confidence scores
 * 5. Tests the "new commitment check" feature
 * 
 * Exit codes:
 *   0 - No contradictions found
 *   1 - Contradictions detected or error occurred
 */

import { PrismaClient } from '@prisma/client';
import { 
  detectContradictions, 
  analyzeContradictions,
  checkNewCommitmentContradictions,
  type CommitmentRecord 
} from '../lib/aif/dialogue-contradictions';

const prisma = new PrismaClient();

const DELIBERATION_ID = 'ludics-forest-demo';

interface DialogueMove {
  id: string;
  kind: string;
  actorId: string;
  targetType: string;
  targetId: string | null;
  createdAt: Date;
}

interface Claim {
  id: string;
  text: string;
}

interface Argument {
  id: string;
  conclusionClaimId: string;
  claim: Claim;
}

async function getCommitments(deliberationId: string, participantId?: string): Promise<CommitmentRecord[]> {
  console.log(`\n📋 Fetching commitments for deliberation: ${deliberationId}`);
  if (participantId) {
    console.log(`   Filtering by participant: ${participantId}`);
  }
  
  // Fetch dialogue moves
  const moves = await prisma.dialogueMove.findMany({
    where: {
      deliberationId,
      ...(participantId ? { actorId: participantId } : {}),
      kind: {
        in: ['ASSERT', 'CONCEDE', 'RETRACT']
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
  
  console.log(`   Found ${moves.length} relevant dialogue moves`);
  
  // Fetch claims and arguments separately
  const claimIds = moves
    .filter(m => m.targetType === 'claim' && m.targetId)
    .map(m => m.targetId!);
  
  const argumentIds = moves
    .filter(m => m.targetType === 'argument' && m.targetId)
    .map(m => m.targetId!);
  
  const claims = await prisma.claim.findMany({
    where: { id: { in: claimIds } },
    select: { id: true, text: true }
  });
  
  const claimMap = new Map(claims.map(c => [c.id, c]));
  
  const args = await prisma.argument.findMany({
    where: { id: { in: argumentIds } },
    select: { 
      id: true, 
      conclusionClaimId: true,
      claim: {
        select: { id: true, text: true }
      }
    }
  });
  
  const argumentMap = new Map(args.map(a => [a.id, a]));
  
  // Build commitment records
  const commitmentRecords: CommitmentRecord[] = [];
  const activeCommitments = new Map<string, Set<string>>(); // participantId -> Set<claimId>
  
  for (const move of moves) {
    const actorId = move.actorId || 'unknown';
    
    if (!activeCommitments.has(actorId)) {
      activeCommitments.set(actorId, new Set());
    }
    
    const activeSet = activeCommitments.get(actorId)!;
    
    // Determine claim based on target type
    let claimId: string | null = null;
    let claimText: string | null = null;
    
    if (move.targetType === 'claim' && move.targetId) {
      const claim = claimMap.get(move.targetId);
      if (claim) {
        claimId = claim.id;
        claimText = claim.text;
      }
    } else if (move.targetType === 'argument' && move.targetId) {
      const argument = argumentMap.get(move.targetId);
      if (argument && argument.claim) {
        claimId = argument.conclusionClaimId;
        claimText = argument.claim.text;
      }
    }
    
    if (!claimId || !claimText) continue;
    
    if (move.kind === 'ASSERT' || move.kind === 'CONCEDE') {
      activeSet.add(claimId);
      commitmentRecords.push({
        claimId,
        claimText,
        moveId: move.id,
        moveKind: move.kind as 'ASSERT' | 'CONCEDE',
        timestamp: move.createdAt,
        isActive: true,
      });
    } else if (move.kind === 'RETRACT') {
      activeSet.delete(claimId);
      
      // Mark previous commitments as inactive
      for (const record of commitmentRecords) {
        if (record.claimId === claimId && record.isActive) {
          record.isActive = false;
        }
      }
      
      commitmentRecords.push({
        claimId,
        claimText,
        moveId: move.id,
        moveKind: 'RETRACT',
        timestamp: move.createdAt,
        isActive: false,
      });
    }
  }
  
  // Update final active status
  for (const record of commitmentRecords) {
    if (record.moveKind !== 'RETRACT') {
      const actorId = moves.find(m => m.id === record.moveId)?.actorId;
      if (actorId) {
        const activeSet = activeCommitments.get(actorId);
        record.isActive = activeSet ? activeSet.has(record.claimId) : false;
      }
    }
  }
  
  return commitmentRecords;
}

async function main() {
  console.log('🔍 Contradiction Detection Test Script');
  console.log('=' .repeat(60));
  
  try {
    // Get all commitments for the deliberation
    const allCommitments = await getCommitments(DELIBERATION_ID);
    
    // Group by participant
    const commitmentsByParticipant = new Map<string, CommitmentRecord[]>();
    const moveToActor = new Map<string, string>();
    
    const moves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId: DELIBERATION_ID,
        kind: { in: ['ASSERT', 'CONCEDE', 'RETRACT'] }
      },
      select: {
        id: true,
        actorId: true
      }
    });
    
    for (const move of moves) {
      moveToActor.set(move.id, move.actorId);
    }
    
    for (const commitment of allCommitments) {
      const actorId = moveToActor.get(commitment.moveId) || 'unknown';
      if (!commitmentsByParticipant.has(actorId)) {
        commitmentsByParticipant.set(actorId, []);
      }
      commitmentsByParticipant.get(actorId)!.push(commitment);
    }
    
    console.log(`\n👥 Participants: ${commitmentsByParticipant.size}`);
    
    // Check each participant for contradictions
    let totalContradictions = 0;
    
    for (const [participantId, commitments] of commitmentsByParticipant) {
      const activeCommitments = commitments.filter(c => c.isActive);
      
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`👤 Participant: ${participantId}`);
      console.log(`   Total commitments: ${commitments.length}`);
      console.log(`   Active commitments: ${activeCommitments.length}`);
      
      if (activeCommitments.length === 0) {
        console.log(`   ✓ No active commitments to check`);
        continue;
      }
      
      console.log(`\n   📝 Active Commitments:`);
      activeCommitments.forEach((c, i) => {
        console.log(`      ${i + 1}. "${c.claimText}"`);
        console.log(`         (${c.moveKind} at ${c.timestamp.toISOString().split('T')[0]})`);
      });
      
      // Run contradiction detection
      const analysis = analyzeContradictions(participantId, commitments);
      
      console.log(`\n   🔍 Contradiction Analysis:`);
      console.log(`      Positive claims: ${analysis.positiveCommitments}`);
      console.log(`      Negative claims: ${analysis.negativeCommitments}`);
      console.log(`      Contradictions found: ${analysis.contradictions.length}`);
      
      if (analysis.contradictions.length > 0) {
        console.log(`\n   ⚠️  CONTRADICTIONS DETECTED:`);
        
        analysis.contradictions.forEach((contradiction, i) => {
          totalContradictions++;
          console.log(`\n      ${i + 1}. ${contradiction.type.toUpperCase()}`);
          console.log(`         Claim A: "${contradiction.claimA.text}"`);
          console.log(`         Claim B: "${contradiction.claimB.text}"`);
          console.log(`         Reason: ${contradiction.reason}`);
          console.log(`         Confidence: ${(contradiction.confidence * 100).toFixed(0)}%`);
        });
      } else {
        console.log(`      ✓ No contradictions found`);
      }
    }
    
    // Test new commitment contradiction check
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`\n🧪 Testing New Commitment Check`);
    console.log(`   Simulating: "Doing A is permissible given the norms and constraints of the context C."`);
    
    // Get a participant with commitments
    const testParticipant = Array.from(commitmentsByParticipant.keys())[0];
    if (testParticipant) {
      const testCommitments = commitmentsByParticipant.get(testParticipant)!;
      const newClaimText = "Doing A is permissible given the norms and constraints of the context C.";
      
      const newContradictions = checkNewCommitmentContradictions(
        newClaimText,
        testCommitments
      );
      
      if (newContradictions.length > 0) {
        console.log(`   ⚠️  Would contradict ${newContradictions.length} existing commitment(s):`);
        newContradictions.forEach((c, i) => {
          const existingClaim = c.claimA.id === 'temp-new-claim' ? c.claimB : c.claimA;
          console.log(`      ${i + 1}. "${existingClaim.text}"`);
          console.log(`         Reason: ${c.reason}`);
        });
      } else {
        console.log(`   ✓ No contradictions with new claim`);
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total participants: ${commitmentsByParticipant.size}`);
    console.log(`   Total contradictions: ${totalContradictions}`);
    
    if (totalContradictions > 0) {
      console.log(`\n   ⚠️  Warning: ${totalContradictions} contradiction(s) detected!`);
      process.exit(1);
    } else {
      console.log(`\n   ✅ No contradictions detected - commitments are consistent!`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
