// scripts/test-scheme-inference.ts
/**
 * Test script for Phase 1: Database-Driven Scheme Inference
 * 
 * Validates that all 7 seeded schemes can be correctly inferred from text patterns.
 * Run with: npx tsx scripts/test-scheme-inference.ts
 */

import { inferSchemesFromText, inferAndAssignScheme } from '@/lib/argumentation/schemeInference';
import { prisma } from '@/lib/prismaclient';

type TestCase = {
  text: string;
  expectedScheme: string;
  description: string;
};

const TEST_CASES: TestCase[] = [
  // 1. Expert Opinion
  {
    text: "Dr. Jane Smith, a leading climate scientist with a PhD from MIT, states that global temperatures have risen 1.1°C since pre-industrial times",
    expectedScheme: "expert_opinion",
    description: "Expert Opinion - credentials + statement"
  },
  {
    text: "According to a peer-reviewed study published in Nature, the vaccine is 95% effective",
    expectedScheme: "expert_opinion",
    description: "Expert Opinion - study citation"
  },

  // 2. Practical Reasoning
  {
    text: "We should adopt renewable energy policies in order to achieve our climate goals and reduce carbon emissions",
    expectedScheme: "practical_reasoning",
    description: "Practical Reasoning - should + goal-oriented"
  },
  {
    text: "The government must implement stricter regulations to protect consumer privacy",
    expectedScheme: "practical_reasoning",
    description: "Practical Reasoning - must + action"
  },

  // 3. Positive Consequences
  {
    text: "Adopting this policy will benefit the economy by creating 100,000 new jobs and improving GDP growth",
    expectedScheme: "positive_consequences",
    description: "Positive Consequences - benefit + positive outcomes"
  },
  {
    text: "This approach has positive effects on student outcomes and enhances educational quality",
    expectedScheme: "positive_consequences",
    description: "Positive Consequences - positive effects + improve"
  },

  // 4. Negative Consequences
  {
    text: "This policy will cause significant harm to small businesses and result in job losses",
    expectedScheme: "negative_consequences",
    description: "Negative Consequences - harm + negative results"
  },
  {
    text: "The proposed law poses serious risks and could damage public trust in institutions",
    expectedScheme: "negative_consequences",
    description: "Negative Consequences - risk + damage"
  },

  // 5. Analogy
  {
    text: "Just like how fire needs oxygen to burn, social movements need public support to succeed",
    expectedScheme: "analogy",
    description: "Analogy - just like comparison"
  },
  {
    text: "This situation is analogous to the dot-com bubble of the 1990s",
    expectedScheme: "analogy",
    description: "Analogy - analogous to"
  },

  // 6. Causal
  {
    text: "Higher taxes on cigarettes lead to reduced smoking rates because price increases discourage consumption",
    expectedScheme: "causal",
    description: "Causal - lead to + because"
  },
  {
    text: "If we increase infrastructure spending, then economic growth will accelerate as a result",
    expectedScheme: "causal",
    description: "Causal - if-then + as a result"
  },

  // 7. Classification
  {
    text: "This organism is a mammal because it has fur, produces milk, and gives live birth",
    expectedScheme: "classification",
    description: "Classification - is a + characteristics"
  },
  {
    text: "The company falls under the category of small business as defined by the SBA",
    expectedScheme: "classification",
    description: "Classification - falls under category"
  },
];

async function runTests() {
  console.log('🧪 Testing Database-Driven Scheme Inference (Phase 1)\n');
  console.log('=' .repeat(80));
  
  // Verify schemes exist in database
  const schemes = await prisma.argumentScheme.findMany({
    select: { id: true, key: true, name: true }
  });
  
  console.log(`\n✓ Found ${schemes.length} schemes in database:`);
  schemes.forEach(s => console.log(`  - ${s.key} (${s.name})`));
  console.log('');
  
  if (schemes.length < 7) {
    console.error('❌ Expected at least 7 schemes. Run: npx tsx scripts/schemes.seed.ts');
    process.exit(1);
  }
  
  // Run inference tests
  let passed = 0;
  let failed = 0;
  const failures: { test: TestCase; actual: string[]; expected: string }[] = [];
  
  console.log('=' .repeat(80));
  console.log('Running inference tests...\n');
  
  for (const test of TEST_CASES) {
    try {
      const inferred = await inferSchemesFromText(test.text);
      const topScheme = inferred[0];
      const isMatch = topScheme === test.expectedScheme;
      
      if (isMatch) {
        passed++;
        console.log(`✓ PASS: ${test.description}`);
        console.log(`  Expected: ${test.expectedScheme}, Got: ${topScheme}`);
      } else {
        failed++;
        console.log(`✗ FAIL: ${test.description}`);
        console.log(`  Expected: ${test.expectedScheme}, Got: ${topScheme}`);
        console.log(`  Text: "${test.text.slice(0, 80)}..."`);
        failures.push({ test, actual: inferred, expected: test.expectedScheme });
      }
      console.log('');
    } catch (error) {
      failed++;
      console.error(`✗ ERROR: ${test.description}`);
      console.error(`  ${error}`);
      console.log('');
    }
  }
  
  // Summary
  console.log('=' .repeat(80));
  console.log('\n📊 Test Results:');
  console.log(`  Total: ${TEST_CASES.length}`);
  console.log(`  ✓ Passed: ${passed} (${((passed/TEST_CASES.length)*100).toFixed(1)}%)`);
  console.log(`  ✗ Failed: ${failed} (${((failed/TEST_CASES.length)*100).toFixed(1)}%)`);
  
  if (failures.length > 0) {
    console.log('\n❌ Failed Tests Details:');
    failures.forEach(({ test, actual, expected }) => {
      console.log(`\n  ${test.description}`);
      console.log(`    Expected: ${expected}`);
      console.log(`    Got:      ${actual[0]} (top match)`);
      console.log(`    All:      ${actual.join(', ')}`);
      console.log(`    Text:     "${test.text.slice(0, 100)}..."`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Test inferAndAssignScheme (full flow)
  console.log('\n🔄 Testing full assignment flow (inferAndAssignScheme)...\n');
  
  const sampleText = "Dr. Smith, an expert in virology, claims that the vaccine is safe and effective";
  const schemeId = await inferAndAssignScheme(sampleText);
  
  if (schemeId) {
    const assigned = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      select: { key: true, name: true }
    });
    console.log(`✓ Successfully assigned scheme: ${assigned?.key} (${assigned?.name})`);
    console.log(`  DB ID: ${schemeId}`);
  } else {
    console.log('✗ Failed to assign scheme (returned null)');
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Exit code
  if (failed === 0) {
    console.log('\n✅ All tests passed! Database-driven inference is working correctly.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Review scoring weights in schemeInference.ts`);
    process.exit(1);
  }
}

// Run tests
runTests()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Fatal error:', error);
    prisma.$disconnect();
    process.exit(1);
  });
