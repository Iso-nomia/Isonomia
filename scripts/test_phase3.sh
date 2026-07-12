#!/bin/bash
# Phase 3 Comprehensive Test Suite
# Tests Fix #1 (CommandCard) and Fix #6 (GROUNDS→Arguments)

# Don't exit on errors - we want to count them
set +e

echo "════════════════════════════════════════════════════════════"
echo "  Phase 3 Test Suite - AIF Dialogical Actions"
echo "════════════════════════════════════════════════════════════"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ═══════════════════════════════════════════════════════════════
# Test Setup: Verify Files Exist
# ═══════════════════════════════════════════════════════════════

section "Setup: Verify Phase 3 Files"

FILES=(
    "lib/dialogue/movesToActions.ts"
    "components/dialogue/LegalMoveToolbar.tsx"
    "components/dialogue/command-card/CommandCard.tsx"
    "components/dialogue/command-card/types.ts"
    "app/api/dialogue/move/route.ts"
    "PHASE_3_TEST_GUIDE.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "File exists: $file"
    else
        fail "File missing: $file"
    fi
done

# ═══════════════════════════════════════════════════════════════
# Fix #1: CommandCard Wiring
# ═══════════════════════════════════════════════════════════════

section "Fix #1: CommandCard Wiring"

# Check movesToActions.ts implementation
if grep -q "export function movesToActions" lib/dialogue/movesToActions.ts; then
    pass "movesToActions function exported"
else
    fail "movesToActions function not found"
fi

if grep -q "CommandCardAction\[\]" lib/dialogue/movesToActions.ts; then
    pass "Returns CommandCardAction[] type"
else
    fail "CommandCardAction[] return type not found"
fi

# Check for action groups (top/mid/bottom)
if grep -q "group: 'top'" lib/dialogue/movesToActions.ts; then
    pass "Top row actions configured"
else
    warn "Top row group not found"
fi

if grep -q "group: 'mid'" lib/dialogue/movesToActions.ts; then
    pass "Mid row actions configured"
else
    warn "Mid row group not found"
fi

if grep -q "group: 'bottom'" lib/dialogue/movesToActions.ts; then
    pass "Bottom row scaffolds configured"
else
    warn "Bottom row group not found"
fi

# Check for scaffold support
if grep -q "FORALL_INSTANTIATE" lib/dialogue/movesToActions.ts; then
    pass "Forall scaffold implemented"
else
    warn "Forall scaffold not found"
fi

if grep -q "EXISTS_WITNESS" lib/dialogue/movesToActions.ts; then
    pass "Exists witness scaffold implemented"
else
    warn "Exists witness scaffold not found"
fi

if grep -q "PRESUP_CHALLENGE" lib/dialogue/movesToActions.ts; then
    pass "Presupposition scaffold implemented"
else
    warn "Presupposition scaffold not found"
fi

# Check LegalMoveToolbar integration
if grep -q "import.*CommandCard" components/dialogue/LegalMoveToolbar.tsx; then
    pass "CommandCard imported in toolbar"
else
    fail "CommandCard not imported"
fi

if grep -q "import.*movesToActions" components/dialogue/LegalMoveToolbar.tsx; then
    pass "movesToActions imported in toolbar"
else
    fail "movesToActions not imported"
fi

if grep -q "useCommandCard" components/dialogue/LegalMoveToolbar.tsx; then
    pass "Grid view toggle state added"
else
    fail "Grid view toggle not found"
fi

if grep -q "Grid View\|List View" components/dialogue/LegalMoveToolbar.tsx; then
    pass "Grid/List view button present"
else
    fail "View toggle button not found"
fi

if grep -q "<CommandCard" components/dialogue/LegalMoveToolbar.tsx; then
    pass "CommandCard component rendered"
else
    fail "CommandCard not rendered in toolbar"
fi

# ═══════════════════════════════════════════════════════════════
# Fix #6: GROUNDS → Arguments
# ═══════════════════════════════════════════════════════════════

section "Fix #6: GROUNDS → Arguments"

# Check createArgumentFromGrounds function
if grep -q "async function createArgumentFromGrounds" app/api/dialogue/move/route.ts; then
    pass "createArgumentFromGrounds function exists"
else
    fail "createArgumentFromGrounds function not found"
fi

# Check function signature
if grep -q "deliberationId.*targetClaimId.*authorId.*groundsText.*cqId" app/api/dialogue/move/route.ts; then
    pass "createArgumentFromGrounds has correct parameters"
else
    warn "Function parameters may be incorrect"
fi

# Check for Argument creation
if grep -q "prisma.argument.create" app/api/dialogue/move/route.ts | grep -A 10 "createArgumentFromGrounds"; then
    pass "Creates Argument in database"
else
    warn "Argument creation not found in helper"
fi

# Check GROUNDS handler integration
if grep -q "groundsText.*length.*>.*5" app/api/dialogue/move/route.ts; then
    pass "5-character threshold check present"
else
    warn "Character threshold check not found"
fi

if grep -q "createArgumentFromGrounds" app/api/dialogue/move/route.ts | grep -v "async function"; then
    pass "createArgumentFromGrounds called in GROUNDS handler"
else
    fail "createArgumentFromGrounds not called"
fi

if grep -q "createdArgumentId" app/api/dialogue/move/route.ts; then
    pass "createdArgumentId stored in payload"
else
    warn "createdArgumentId not stored in response"
fi

# Check targetType === 'claim' check
if grep -q "targetType === 'claim'" app/api/dialogue/move/route.ts | grep -A 2 "createArgumentFromGrounds"; then
    pass "Only creates arguments for claim targets"
else
    warn "targetType check may be missing"
fi

# ═══════════════════════════════════════════════════════════════
# Code Quality Checks
# ═══════════════════════════════════════════════════════════════

section "Code Quality"

# Check for TypeScript types
if grep -q "type Move" lib/dialogue/movesToActions.ts; then
    pass "Move type defined"
else
    warn "Move type not defined locally"
fi

if grep -q "TargetRef" lib/dialogue/movesToActions.ts; then
    pass "TargetRef type imported/used"
else
    warn "TargetRef type not found"
fi

# Check for error handling
if grep -q "catch" app/api/dialogue/move/route.ts | grep -A 5 "createArgumentFromGrounds"; then
    pass "Error handling in createArgumentFromGrounds"
else
    warn "No error handling in helper function"
fi

# Check for logging
if grep -q "console.log\|console.error" app/api/dialogue/move/route.ts | grep -A 3 "createArgumentFromGrounds"; then
    pass "Logging present in createArgumentFromGrounds"
else
    warn "No logging in helper function"
fi

# ═══════════════════════════════════════════════════════════════
# Documentation & Testing Resources
# ═══════════════════════════════════════════════════════════════

section "Documentation"

if [ -f "PHASE_3_TEST_GUIDE.md" ]; then
    pass "PHASE_3_TEST_GUIDE.md exists"

    # Check for all tests
    if grep -q "Test A: CommandCard Grid Display" PHASE_3_TEST_GUIDE.md; then
        pass "Test A documented"
    fi

    if grep -q "Test B: Scaffold Template" PHASE_3_TEST_GUIDE.md; then
        pass "Test B documented"
    fi

    if grep -q "Test C: GROUNDS Creates Arguments" PHASE_3_TEST_GUIDE.md; then
        pass "Test C documented"
    fi

    if grep -q "Test D: GROUNDS.*Threshold" PHASE_3_TEST_GUIDE.md; then
        pass "Test D documented"
    fi

    if grep -q "Test E: Disabled States" PHASE_3_TEST_GUIDE.md; then
        pass "Test E documented"
    fi

    if grep -q "Test F: End-to-End" PHASE_3_TEST_GUIDE.md; then
        pass "Test F documented"
    fi
else
    fail "PHASE_3_TEST_GUIDE.md missing"
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════

section "Test Summary"

echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start development server: npm run dev"
    echo "  2. Open browser to test UI components"
    echo "  3. Run manual tests from PHASE_3_TEST_GUIDE.md"
    echo "  4. Execute API integration tests"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review the output above.${NC}"
    exit 1
fi
