#!/bin/bash

# Test script for /api/aif/graph-with-dialogue endpoint
# Prerequisites: Dev server must be running (yarn dev)

echo "🧪 Testing Dialogue-Aware Graph API via HTTP"
echo "======================================================================"
echo ""

# Base URL (adjust if needed)
BASE_URL="http://localhost:3000"

# Test deliberation ID (update with a deliberation that has dialogue moves)
DELIB_ID="cmert9rjq000brm7c7qb5xfwb"

echo "📊 Test 1: Basic AIF graph (no dialogue layer)"
echo "----------------------------------------------------------------------"
curl -s "${BASE_URL}/api/aif/graph-with-dialogue?deliberationId=${DELIB_ID}" | jq '{
  nodeCount: (.nodes | length),
  edgeCount: (.edges | length),
  dialogueMoveCount: (.dialogueMoves | length),
  sampleNode: .nodes[0]
}'
echo ""
echo ""

echo "📊 Test 2: AIF graph WITH dialogue layer (all moves)"
echo "----------------------------------------------------------------------"
curl -s "${BASE_URL}/api/aif/graph-with-dialogue?deliberationId=${DELIB_ID}&includeDialogue=true&includeMoves=all" | jq '{
  nodeCount: (.nodes | length),
  edgeCount: (.edges | length),
  dialogueMoveCount: (.dialogueMoves | length),
  dmNodeCount: (.nodes | map(select(.nodeType | startswith("aif:DialogueMove_"))) | length),
  commitmentStoreCount: (.commitmentStores | length)
}'
echo ""
echo ""

echo "📊 Test 3: Filter to protocol moves only"
echo "----------------------------------------------------------------------"
curl -s "${BASE_URL}/api/aif/graph-with-dialogue?deliberationId=${DELIB_ID}&includeDialogue=true&includeMoves=protocol" | jq '{
  nodeCount: (.nodes | length),
  dialogueMoveCount: (.dialogueMoves | length),
  moveKinds: (.dialogueMoves | map(.kind) | unique)
}'
echo ""
echo ""

echo "📊 Test 4: Edge types and provenance"
echo "----------------------------------------------------------------------"
curl -s "${BASE_URL}/api/aif/graph-with-dialogue?deliberationId=${DELIB_ID}&includeDialogue=true" | jq '{
  edgeCount: (.edges | length),
  edgeTypes: (.edges | map(.edgeType) | group_by(.) | map({type: .[0], count: length})),
  edgesWithProvenance: (.edges | map(select(.causedByDialogueMoveId != null)) | length)
}'
echo ""
echo ""

echo "======================================================================"
echo "✅ All HTTP tests completed!"
echo ""
echo "To update test deliberation ID:"
echo "  1. Query database for deliberation with dialogue moves"
echo "  2. Update DELIB_ID variable in this script"
echo ""
