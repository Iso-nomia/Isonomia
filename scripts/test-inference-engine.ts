#!/usr/bin/env tsx
/**
 * Manual test script for Ludics inference engine
 * Run: npx tsx scripts/test-inference-engine.ts
 */

import { applyToCS, interactCE, listCS, setEntitlement } from '../packages/ludics-engine/commitments';
import { prisma } from '../lib/prismaclient';

// Test utilities
let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`✅ PASS: ${message}`);
  } else {
    failCount++;
    console.log(`❌ FAIL: ${message}`);
  }
}

function assertArrayContains(arr: any[], item: any, message: string) {
  const found = arr.some(a => JSON.stringify(a) === JSON.stringify(item));
  assert(found, message);
}

function assertArrayLength(arr: any[], expected: number, message: string) {
  assert(arr.length === expected, `${message} (expected ${expected}, got ${arr.length})`);
}

// Test data
const TEST_DIALOGUE_ID = 'test-inference-engine-' + Date.now();
const PROPONENT = 'Proponent';
const OPPONENT = 'Opponent';

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  // Delete in correct order (foreign key constraints)
  // 1. Delete commitment elements first
  await prisma.ludicCommitmentElement.deleteMany({ 
    where: { 
      OR: [
        { ownerId: PROPONENT },
        { ownerId: OPPONENT }
      ]
    } 
  });
  // 2. Delete commitment states
  await prisma.ludicCommitmentState.deleteMany({ 
    where: { 
      ownerId: { in: [PROPONENT, OPPONENT] } 
    } 
  });
  // 3. Delete test loci last
  await prisma.ludicLocus.deleteMany({ 
    where: { dialogueId: TEST_DIALOGUE_ID } 
  });
  console.log('✅ Cleanup complete\n');
}

async function runTests() {
  console.log('🧪 Ludics Inference Engine Test Suite\n');
  console.log('='.repeat(60) + '\n');

  try {
    // ========================================
    // Test 1: Basic Fact Addition
    // ========================================
    console.log('Test 1: Basic Fact Addition');
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [{ label: 'congestion_high', basePolarity: 'pos' }],
    });
    const result1 = await listCS(TEST_DIALOGUE_ID, PROPONENT);
    assert(result1.ok, 'Test 1: listCS returns ok');
    assertArrayLength(result1.facts, 1, 'Test 1: One fact added');
    assert(result1.facts[0]?.label === 'congestion_high', 'Test 1: Fact label correct');
    console.log('');

    // ========================================
    // Test 2: Simple Rule Inference
    // ========================================
    console.log('Test 2: Simple Rule Inference');
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [{ label: 'congestion_high -> negative_impact', basePolarity: 'neg' }],
    });
    const infer2 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assert(infer2.ok, 'Test 2: interactCE returns ok');
    assertArrayLength(infer2.derivedFacts, 1, 'Test 2: One fact derived');
    assert(infer2.derivedFacts[0]?.label === 'negative_impact', 'Test 2: Derived fact correct');
    assertArrayLength(infer2.contradictions, 0, 'Test 2: No contradictions');
    console.log('');

    // ========================================
    // Test 3: Chained Inference (A -> B, B -> C)
    // ========================================
    console.log('Test 3: Chained Inference');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'A -> B', basePolarity: 'neg' },
        { label: 'B -> C', basePolarity: 'neg' },
      ],
    });
    const infer3 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer3.derivedFacts, 2, 'Test 3: Two facts derived (B and C)');
    const labels3 = infer3.derivedFacts.map(f => f.label).sort();
    assert(labels3[0] === 'B' && labels3[1] === 'C', 'Test 3: B and C derived');
    console.log('');

    // ========================================
    // Test 4: Conjunction (A & B -> C)
    // ========================================
    console.log('Test 4: Conjunction in Rule');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'B', basePolarity: 'pos' },
        { label: 'A & B -> C', basePolarity: 'neg' },
      ],
    });
    const infer4 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer4.derivedFacts, 1, 'Test 4: One fact derived (C)');
    assert(infer4.derivedFacts[0]?.label === 'C', 'Test 4: C derived from A & B');
    console.log('');

    // ========================================
    // Test 4b: Conjunction with missing precondition
    // ========================================
    console.log('Test 4b: Conjunction with Missing Precondition');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        // B is missing
        { label: 'A & B -> C', basePolarity: 'neg' },
      ],
    });
    const infer4b = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer4b.derivedFacts, 0, 'Test 4b: No facts derived (B missing)');
    console.log('');

    // ========================================
    // Test 5: Negation in Precondition
    // ========================================
    console.log('Test 5: Negation in Precondition');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'not B', basePolarity: 'pos' },
        { label: 'A & not B -> C', basePolarity: 'neg' },
      ],
    });
    const infer5 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer5.derivedFacts, 1, 'Test 5: One fact derived');
    assert(infer5.derivedFacts[0]?.label === 'C', 'Test 5: C derived from A & not B');
    console.log('');

    // ========================================
    // Test 6: Negation in Consequent
    // ========================================
    console.log('Test 6: Negation in Consequent');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'A -> not B', basePolarity: 'neg' },
      ],
    });
    const infer6 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer6.derivedFacts, 1, 'Test 6: One fact derived');
    assert(infer6.derivedFacts[0]?.label === 'not B', 'Test 6: not B derived');
    console.log('');

    // ========================================
    // Test 7: Contradiction Detection (Explicit)
    // ========================================
    console.log('Test 7: Contradiction Detection (Explicit)');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'traffic_good', basePolarity: 'pos' },
        { label: 'not traffic_good', basePolarity: 'pos' },
      ],
    });
    const infer7 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer7.contradictions, 1, 'Test 7: One contradiction detected');
    assert(infer7.contradictions[0]?.a === 'traffic_good', 'Test 7: Contradiction pair correct');
    console.log('');

    // ========================================
    // Test 8: Derived Contradiction
    // ========================================
    console.log('Test 8: Derived Contradiction');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'congestion_high', basePolarity: 'pos' },
        { label: 'traffic_good', basePolarity: 'pos' },
        { label: 'congestion_high -> not traffic_good', basePolarity: 'neg' },
      ],
    });
    const infer8 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer8.derivedFacts, 1, 'Test 8: not traffic_good derived');
    assertArrayLength(infer8.contradictions, 1, 'Test 8: Contradiction detected');
    console.log('');

    // ========================================
    // Test 9: Entitlement (Suspension)
    // ========================================
    console.log('Test 9: Entitlement (Suspension)');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos', entitled: true },
        { label: 'A -> B', basePolarity: 'neg' },
      ],
    });
    const infer9a = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer9a.derivedFacts, 1, 'Test 9a: B derived when A is entitled');
    
    // Suspend A
    await setEntitlement(PROPONENT, 'A', false);
    const infer9b = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer9b.derivedFacts, 0, 'Test 9b: B NOT derived when A is suspended');
    console.log('');

    // ========================================
    // Test 10: Unicode Negation (¬)
    // ========================================
    console.log('Test 10: Unicode Negation');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: '¬B', basePolarity: 'pos' },
        { label: 'A & ¬B -> C', basePolarity: 'neg' },
      ],
    });
    const infer10 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer10.derivedFacts, 1, 'Test 10: C derived with unicode negation');
    console.log('');

    // ========================================
    // Test 11: Multiple Rule Formats
    // ========================================
    console.log('Test 11: Multiple Rule Formats');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'A -> B', basePolarity: 'neg' },
        { label: 'A => C', basePolarity: 'neg' },
        { label: 'A,B -> D', basePolarity: 'neg' },
        { label: 'A&B->E', basePolarity: 'neg' },
      ],
    });
    const infer11 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    const labels11 = infer11.derivedFacts.map(f => f.label).sort();
    // B and C derive immediately, then D and E in second iteration
    assert(labels11.includes('B'), 'Test 11: B derived with ->');
    assert(labels11.includes('C'), 'Test 11: C derived with =>');
    assert(labels11.includes('D'), 'Test 11: D derived with comma');
    assert(labels11.includes('E'), 'Test 11: E derived with &');
    console.log('');

    // ========================================
    // Test 12: Deep Inference Chain (5 levels)
    // ========================================
    console.log('Test 12: Deep Inference Chain');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'A -> B', basePolarity: 'neg' },
        { label: 'B -> C', basePolarity: 'neg' },
        { label: 'C -> D', basePolarity: 'neg' },
        { label: 'D -> E', basePolarity: 'neg' },
      ],
    });
    const infer12 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer12.derivedFacts, 4, 'Test 12: All 4 facts derived (B, C, D, E)');
    const labels12 = infer12.derivedFacts.map(f => f.label).sort();
    assert(labels12.join(',') === 'B,C,D,E', 'Test 12: Correct derivation chain');
    console.log('');

    // ========================================
    // Test 13: Whitespace Handling
    // ========================================
    console.log('Test 13: Whitespace Handling');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: '  congestion_high  ', basePolarity: 'pos' },
        { label: 'congestion_high -> impact', basePolarity: 'neg' },
      ],
    });
    const infer13 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer13.derivedFacts, 1, 'Test 13: Derivation works with extra whitespace');
    console.log('');

    // ========================================
    // Test 14: Circular Rules (A -> B, B -> A)
    // ========================================
    console.log('Test 14: Circular Rules');
    await cleanup();
    await applyToCS(TEST_DIALOGUE_ID, PROPONENT, {
      add: [
        { label: 'A', basePolarity: 'pos' },
        { label: 'A -> B', basePolarity: 'neg' },
        { label: 'B -> A', basePolarity: 'neg' },
      ],
    });
    const infer14 = await interactCE(TEST_DIALOGUE_ID, PROPONENT);
    assertArrayLength(infer14.derivedFacts, 1, 'Test 14: Only B derived (A already exists)');
    assert(infer14.derivedFacts[0]?.label === 'B', 'Test 14: B derived correctly');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test suite crashed:', error);
    failCount++;
  } finally {
    await cleanup();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   Total Tests: ${testCount}`);
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   Success Rate: ${Math.round((passCount / testCount) * 100)}%\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
