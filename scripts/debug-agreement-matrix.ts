import { getCommitmentStores } from "../lib/aif/graph-builder";
import { computeCommitmentAnalytics } from "../lib/aif/commitment-analytics";

async function debugAgreementMatrix() {
  const deliberationId = "ludics-forest-demo"; // Has 190 moves
  
  console.log("\n=== Fetching Commitment Stores ===\n");
  
  const result = await getCommitmentStores(deliberationId);
  
  if (!result || !result.data) {
    console.error("Failed to fetch stores");
    return;
  }
  
  const stores = result.data;
  
  console.log(`Found ${stores.length} participants\n`);
  
  for (const store of stores) {
    const activeCount = store.commitments.filter((c: any) => c.isActive).length;
    console.log(`  ${store.participantName}: ${activeCount} active / ${store.commitments.length} total`);
  }
  
  console.log("\n=== Computing Analytics ===\n");
  
  const analytics = computeCommitmentAnalytics(stores);
  const matrix = analytics.agreementMatrix;
  
  console.log(`Participants: ${matrix.participants.length}`);
  console.log(`Average agreement: ${(matrix.avgAgreement * 100).toFixed(1)}%`);
  console.log(`Max agreement: ${(matrix.maxAgreement * 100).toFixed(1)}%`);
  console.log(`Min agreement: ${(matrix.minAgreement * 100).toFixed(1)}%`);
  
  console.log("\n=== Agreement Matrix ===\n");
  
  for (let i = 0; i < Math.min(3, matrix.participants.length); i++) {
    const p1 = matrix.participants[i];
    console.log(`\n${p1.name} (${p1.activeCommitmentCount} active):`);
    
    for (let j = 0; j < Math.min(3, matrix.participants.length); j++) {
      if (i === j) continue;
      const p2 = matrix.participants[j];
      const agreement = matrix.matrix[i][j];
      
      console.log(`  → ${p2.name}: ${(agreement.agreementScore * 100).toFixed(1)}% (${agreement.sharedClaims} shared / ${agreement.totalClaims} total)`);
    }
  }
  console.log("\n=== Claim Analysis ===\n");
  
  // Get claim IDs for first 3 participants
  for (let i = 0; i < Math.min(3, stores.length); i++) {
    const store = stores[i];
    const activeClaims = store.commitments.filter((c: any) => c.isActive);
    const uniqueClaimIds = new Set(activeClaims.map((c: any) => c.claimId));
    
    console.log(`\n${store.participantName}:`);
    console.log(`  Unique active claims: ${uniqueClaimIds.size}`);
    console.log(`  Claim IDs (first 5):`);
    
    Array.from(uniqueClaimIds).slice(0, 5).forEach((id: any) => {
      const text = activeClaims.find((c: any) => c.claimId === id)?.claimText || '';
      console.log(`    - ${id.substring(0, 15)}... "${text.substring(0, 40)}..."`);
    });
  }
  
  // Check for ANY overlap
  console.log("\n=== Checking for Overlaps ===\n");
  
  const allClaimSets = stores.map(store => {
    const activeClaims = store.commitments.filter((c: any) => c.isActive);
    return {
      name: store.participantName,
      claims: new Set(activeClaims.map((c: any) => c.claimId))
    };
  });
  
  let foundAnyOverlap = false;
  for (let i = 0; i < allClaimSets.length; i++) {
    for (let j = i + 1; j < allClaimSets.length; j++) {
      const shared = Array.from(allClaimSets[i].claims).filter(id => 
        allClaimSets[j].claims.has(id)
      );
      
      if (shared.length > 0) {
        console.log(`${allClaimSets[i].name} ↔ ${allClaimSets[j].name}: ${shared.length} shared`);
        foundAnyOverlap = true;
      }
    }
  }
  
  if (!foundAnyOverlap) {
    console.log("❌ No overlapping claims found between any participants!");
    console.log("\nThis explains the 0% agreement - each participant is committing");
    console.log("to completely different claims.");
  }
}

debugAgreementMatrix()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
