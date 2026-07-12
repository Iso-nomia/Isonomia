#!/bin/bash
# Phase 2 Testing Script
# Run this after applying the database migration

echo "======================================"
echo "Phase 2 Testing - Verification Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "This script helps verify Phase 2 changes are working correctly."
echo ""

# Check if migration file exists
echo "1. Checking migration file..."
if [ -f "database/migrations/20251021_add_metajson_to_conflict_application.sql" ]; then
    echo -e "${GREEN}✓ Migration file exists${NC}"
else
    echo -e "${RED}✗ Migration file not found!${NC}"
    exit 1
fi

# Check if modified files exist
echo ""
echo "2. Checking modified files..."
files=(
    "app/api/ca/route.ts"
    "app/api/cqs/attachments/route.ts"
    "components/arguments/AIFArgumentsListPro.tsx"
    "lib/argumentation/schemeInference.ts"
    "lib/models/schema.prisma"
)

all_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ $file NOT FOUND${NC}"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    echo -e "${RED}Some files are missing!${NC}"
    exit 1
fi

echo ""
echo "3. Checking for key code changes..."

# Check if metaJson is in schema
if grep -q "metaJson Json?" lib/models/schema.prisma; then
    echo -e "${GREEN}✓ schema.prisma has metaJson field${NC}"
else
    echo -e "${RED}✗ schema.prisma missing metaJson field${NC}"
fi

# Check if schemeInference is imported
if grep -q "inferAndAssignScheme" app/api/arguments/route.ts; then
    echo -e "${GREEN}✓ arguments/route.ts uses scheme inference${NC}"
else
    echo -e "${RED}✗ arguments/route.ts missing scheme inference${NC}"
fi

# Check if metaJson is in API
if grep -q "metaJson" app/api/ca/route.ts; then
    echo -e "${GREEN}✓ ca/route.ts handles metaJson${NC}"
else
    echo -e "${RED}✗ ca/route.ts missing metaJson handling${NC}"
fi

# Check if refreshing state exists
if grep -q "const \[refreshing, setRefreshing\]" components/arguments/AIFArgumentsListPro.tsx; then
    echo -e "${GREEN}✓ AIFArgumentsListPro has loading state${NC}"
else
    echo -e "${RED}✗ AIFArgumentsListPro missing loading state${NC}"
fi

echo ""
echo "======================================"
echo "File verification complete!"
echo "======================================"
echo ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo ""
echo "1. Run the database migration:"
echo "   ${YELLOW}psql \$DATABASE_URL -f database/migrations/20251021_add_metajson_to_conflict_application.sql${NC}"
echo ""
echo "2. Verify the migration:"
echo "   ${YELLOW}psql \$DATABASE_URL -c \"\\d ConflictApplication\"${NC}"
echo "   (Look for 'metaJson | jsonb' column)"
echo ""
echo "3. Start your dev server:"
echo "   ${YELLOW}npm run dev${NC}"
echo ""
echo "4. Test the features:"
echo "   - Create an argument (should auto-assign scheme)"
echo "   - Create an attack from CQ panel (should record metaJson)"
echo "   - Observe loading spinner during refresh"
echo "   - Verify CQ checkbox auto-enables"
echo ""
echo "See PHASE_2_TEST_GUIDE.md for detailed test procedures."
echo ""
