async function testContradictionAPI() {
  const baseUrl = "http://localhost:3000";

  // Test for Alice (should have 1 contradiction)
  console.log("Testing contradiction detection for Alice...\n");

  try {
    const response = await fetch(
      `${baseUrl}/api/dialogue/contradictions?deliberationId=ludics-forest-demo&participantId=test-alice`
    );
    const data = await response.json();

    if (!data.ok) {
      console.error("API returned error:", data);
      return;
    }

    console.log(`Found ${data.contradictions.length} contradictions for Alice:\n`);

    for (const contradiction of data.contradictions) {
      console.log(`Contradiction detected:`);
      console.log(`  Claim 1: ${contradiction.commitment1.claimText}`);
      console.log(`  Claim 2: ${contradiction.commitment2.claimText}`);
      console.log(`  Type: ${contradiction.type}`);
      console.log(`  Confidence: ${contradiction.confidence}`);
      console.log(`  Reason: ${contradiction.reason}\n`);
    }

    console.log(`Metadata:`);
    console.log(`  Total commitments: ${data.metadata.totalCommitments}`);
    console.log(`  Contradiction count: ${data.metadata.contradictionCount}`);
    console.log(`  Checked at: ${data.metadata.checkedAt}`);
  } catch (err: any) {
    if (err.cause?.code === "ECONNREFUSED") {
      console.log("⚠️  Dev server not running. Start with: npm run dev");
      console.log("   Then run this test again.");
    } else {
      console.error("Error:", err.message);
    }
  }
}

testContradictionAPI().then(() => process.exit(0));
