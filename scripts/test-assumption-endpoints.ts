// scripts/test-assumption-endpoints.ts
/**
 * Test script for Gap 4 API endpoints
 * 
 * Tests all 4 new endpoints with real data from the database.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_BASE = "http://localhost:3000";

async function testEndpoints() {
  console.log("🧪 Testing Gap 4 API Endpoints\n");
  console.log("=" .repeat(60));

  try {
    // 1. Find test data
    console.log("\n📊 Finding test data...\n");

    const deliberation = await prisma.deliberation.findFirst({
      select: { id: true, title: true }
    });

    if (!deliberation) {
      console.log("❌ No deliberations found. Create one first.");
      return;
    }

    console.log(`✅ Found deliberation: ${deliberation.title} (${deliberation.id})`);

    const argument = await prisma.argument.findFirst({
      where: { deliberationId: deliberation.id },
      select: { id: true, text: true }
    });

    if (!argument) {
      console.log("❌ No arguments found in this deliberation.");
      return;
    }

    console.log(`✅ Found argument: ${argument.text?.substring(0, 50)}... (${argument.id})`);

    const derivation = await prisma.argumentSupport.findFirst({
      where: { argumentId: argument.id },
      select: { id: true, argumentId: true }
    });

    if (!derivation) {
      console.log("❌ No derivations (ArgumentSupport) found for this argument.");
      return;
    }

    console.log(`✅ Found derivation: ${derivation.id}`);

    const assumption = await prisma.assumptionUse.findFirst({
      where: { 
        deliberationId: deliberation.id,
        status: "ACCEPTED"
      },
      select: { id: true, assumptionText: true, assumptionClaimId: true }
    });

    if (!assumption) {
      console.log("⚠️  No ACCEPTED assumptions found. Will create test link anyway.");
    } else {
      console.log(`✅ Found assumption: ${assumption.assumptionText?.substring(0, 50) || assumption.assumptionClaimId} (${assumption.id})`);
    }

    // 2. Test Endpoint 1: GET /api/derivations/[id]/assumptions
    console.log("\n" + "=".repeat(60));
    console.log("\n🔍 Test 1: GET /api/derivations/[id]/assumptions\n");

    const endpoint1Response = await fetch(`${API_BASE}/api/derivations/${derivation.id}/assumptions`);
    const endpoint1Data = await endpoint1Response.json();

    console.log(`Status: ${endpoint1Response.status}`);
    console.log(`Response:`, JSON.stringify(endpoint1Data, null, 2));

    if (endpoint1Data.ok) {
      console.log(`✅ Endpoint 1 works! Found ${endpoint1Data.assumptions.length} assumptions.`);
    } else {
      console.log(`❌ Endpoint 1 failed:`, endpoint1Data.error);
    }

    // 3. Test Endpoint 2: POST /api/assumptions/[id]/link
    if (assumption) {
      console.log("\n" + "=".repeat(60));
      console.log("\n🔗 Test 2: POST /api/assumptions/[id]/link\n");

      const endpoint2Response = await fetch(`${API_BASE}/api/assumptions/${assumption.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          derivationId: derivation.id,
          weight: 0.85
        })
      });
      const endpoint2Data = await endpoint2Response.json();

      console.log(`Status: ${endpoint2Response.status}`);
      console.log(`Response:`, JSON.stringify(endpoint2Data, null, 2));

      if (endpoint2Data.ok) {
        console.log(`✅ Endpoint 2 works! Link created: ${endpoint2Data.link.id}`);
        
        // Re-test endpoint 1 to see the new link
        console.log("\n📊 Re-checking derivation assumptions after link...\n");
        const recheck = await fetch(`${API_BASE}/api/derivations/${derivation.id}/assumptions`);
        const recheckData = await recheck.json();
        console.log(`Now has ${recheckData.assumptions.length} assumptions`);
      } else {
        console.log(`❌ Endpoint 2 failed:`, endpoint2Data.error);
      }
    }

    // 4. Test Endpoint 3: GET /api/arguments/[id]/minimal-assumptions
    console.log("\n" + "=".repeat(60));
    console.log("\n📈 Test 3: GET /api/arguments/[id]/minimal-assumptions\n");

    const endpoint3Response = await fetch(`${API_BASE}/api/arguments/${argument.id}/minimal-assumptions`);
    const endpoint3Data = await endpoint3Response.json();

    console.log(`Status: ${endpoint3Response.status}`);
    console.log(`Response:`, JSON.stringify(endpoint3Data, null, 2));

    if (endpoint3Data.ok) {
      console.log(`✅ Endpoint 3 works!`);
      console.log(`   - Derivations: ${endpoint3Data.derivations.length}`);
      console.log(`   - Minimal assumptions: ${endpoint3Data.minimalSet.length}`);
      if (endpoint3Data.minimalSet.length > 0) {
        console.log(`   - Top assumption (criticality ${endpoint3Data.minimalSet[0].criticalityScore.toFixed(2)}): ${endpoint3Data.minimalSet[0].text.substring(0, 50)}...`);
      }
    } else {
      console.log(`❌ Endpoint 3 failed:`, endpoint3Data.error);
    }

    // 5. Test Endpoint 4: GET /api/deliberations/[id]/assumption-graph
    console.log("\n" + "=".repeat(60));
    console.log("\n🕸️  Test 4: GET /api/deliberations/[id]/assumption-graph\n");

    const endpoint4Response = await fetch(`${API_BASE}/api/deliberations/${deliberation.id}/assumption-graph`);
    const endpoint4Data = await endpoint4Response.json();

    console.log(`Status: ${endpoint4Response.status}`);
    if (endpoint4Data.ok) {
      console.log(`✅ Endpoint 4 works!`);
      console.log(`   Stats:`, JSON.stringify(endpoint4Data.stats, null, 2));
      console.log(`   - Total nodes: ${endpoint4Data.nodes.length}`);
      console.log(`   - Total edges: ${endpoint4Data.edges.length}`);
      
      const nodeTypes = endpoint4Data.nodes.reduce((acc: any, n: any) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`   - Node types:`, nodeTypes);
      
      const edgeTypes = endpoint4Data.edges.reduce((acc: any, e: any) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {});
      console.log(`   - Edge types:`, edgeTypes);
    } else {
      console.log(`❌ Endpoint 4 failed:`, endpoint4Data.error);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ All endpoint tests complete!\n");

  } catch (error: any) {
    console.error("\n❌ Test error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testEndpoints();
