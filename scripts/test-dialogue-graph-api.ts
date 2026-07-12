#!/usr/bin/env tsx
/**
 * Test Script: API Endpoint for Dialogue-Aware AIF Graphs
 * 
 * Tests /api/aif/graph-with-dialogue endpoint with various parameter combinations
 */

import { buildDialogueAwareGraph } from "@/lib/aif/graph-builder";

async function testGraphBuilder() {
  console.log("🧪 Testing Dialogue-Aware Graph Builder\n");
  console.log("=" .repeat(70));

  const testDeliberationId = "cmert9rjq000brm7c7qb5xfwb";

  // Test 1: Basic graph without dialogue layer
  console.log("\n📊 Test 1: Basic AIF graph (no dialogue layer)");
  console.log("-".repeat(70));
  
  try {
    const basicGraph = await buildDialogueAwareGraph(testDeliberationId, {
      includeDialogue: false,
    });

    console.log(`✅ Success!`);
    console.log(`   Nodes: ${basicGraph.nodes.length}`);
    console.log(`   Edges: ${basicGraph.edges.length}`);
    console.log(`   Dialogue moves: ${basicGraph.dialogueMoves.length}`);
    console.log(`   DM-nodes: ${basicGraph.metadata?.dmNodeCount || 0}`);
    
    // Sample node
    if (basicGraph.nodes.length > 0) {
      const sampleNode = basicGraph.nodes[0];
      console.log(`\n   Sample node:`);
      console.log(`   - ID: ${sampleNode.id}`);
      console.log(`   - Type: ${sampleNode.nodeType}`);
      console.log(`   - Text: ${sampleNode.text?.slice(0, 60)}...`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error instanceof Error ? error.message : error);
  }

  // Test 2: Full graph with dialogue layer
  console.log("\n\n📊 Test 2: AIF graph WITH dialogue layer");
  console.log("-".repeat(70));
  
  try {
    const fullGraph = await buildDialogueAwareGraph(testDeliberationId, {
      includeDialogue: true,
      includeMoves: "all",
    });

    console.log(`✅ Success!`);
    console.log(`   Nodes: ${fullGraph.nodes.length}`);
    console.log(`   Edges: ${fullGraph.edges.length}`);
    console.log(`   Dialogue moves: ${fullGraph.dialogueMoves.length}`);
    console.log(`   DM-nodes: ${fullGraph.metadata?.dmNodeCount || 0}`);
    console.log(`   Commitment stores: ${Object.keys(fullGraph.commitmentStores).length} participants`);

    // Sample DM-node
    const dmNode = fullGraph.nodes.find(n => n.nodeSubtype === "dialogue_move");
    if (dmNode) {
      console.log(`\n   Sample DM-node:`);
      console.log(`   - ID: ${dmNode.id}`);
      console.log(`   - Type: ${dmNode.nodeType}`);
      console.log(`   - Locution: ${dmNode.dialogueMetadata?.locution}`);
      console.log(`   - Speaker: ${dmNode.dialogueMetadata?.speaker}`);
    }

    // Sample edge with dialogue provenance
    const edgeWithProvenance = fullGraph.edges.find(e => e.causedByDialogueMoveId);
    if (edgeWithProvenance) {
      console.log(`\n   Sample edge with dialogue provenance:`);
      console.log(`   - Source: ${edgeWithProvenance.source}`);
      console.log(`   - Target: ${edgeWithProvenance.target}`);
      console.log(`   - Type: ${edgeWithProvenance.edgeType}`);
      console.log(`   - Caused by move: ${edgeWithProvenance.causedByDialogueMoveId?.slice(0, 8)}...`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error instanceof Error ? error.message : error);
  }

  // Test 3: Filter by protocol moves only
  console.log("\n\n📊 Test 3: Filter to protocol moves only");
  console.log("-".repeat(70));
  
  try {
    const protocolGraph = await buildDialogueAwareGraph(testDeliberationId, {
      includeDialogue: true,
      includeMoves: "protocol",
    });

    console.log(`✅ Success!`);
    console.log(`   Dialogue moves (protocol only): ${protocolGraph.dialogueMoves.length}`);
    console.log(`   Move kinds: ${[...new Set(protocolGraph.dialogueMoves.map(m => m.kind))].join(", ")}`);
  } catch (error) {
    console.error(`❌ Error:`, error instanceof Error ? error.message : error);
  }

  // Test 4: Check commitment stores
  console.log("\n\n📊 Test 4: Commitment stores analysis");
  console.log("-".repeat(70));
  
  try {
    const graph = await buildDialogueAwareGraph(testDeliberationId, {
      includeDialogue: true,
    });

    const participants = Object.keys(graph.commitmentStores);
    console.log(`✅ Success!`);
    console.log(`   Participants with commitments: ${participants.length}`);
    
    for (const participantId of participants.slice(0, 3)) {
      const commitments = graph.commitmentStores[participantId];
      console.log(`\n   Participant ${participantId.slice(0, 8)}:`);
      console.log(`   - Committed claims: ${commitments.length}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error instanceof Error ? error.message : error);
  }

  console.log("\n" + "=".repeat(70));
  console.log("✅ All tests completed!\n");
}

testGraphBuilder()
  .catch((error) => {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
